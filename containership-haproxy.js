var os = require("os");
var fs = require("fs");
var _ = require("lodash");
var async = require("async");
var crypto = require("crypto");
var child_process = require("child_process");
var MyriadKVClient = require("myriad-kv-client");
var template = require([__dirname, "lib", "template"].join("/"));

var config = {};

var interfaces = os.networkInterfaces();
var myriad_host;

if(_.has(interfaces, process.env.MYRIAD_INTERFACE)){
    var iface = _.find(interfaces[process.env.MYRIAD_INTERFACE], function(iface){
        return iface.family == "IPv4";
    });

    if(!_.isUndefined(iface) && _.has(iface, "address"))
        myriad_host = iface.address;
}

config.myriad = _.defaults({
    host: myriad_host,
    port: process.env.MYRIAD_PORT
}, {
    host: "127.0.0.1",
    port: 2666
});

config.haproxy = _.defaults({
    max_connections: process.env.HAPROXY_GLOBAL_MAX_CONN,
    connect_timeout: process.env.HAPROXY_DEFAULT_CONNECT_TIMEOUT,
    client_timeout: process.env.HAPROXY_DEFAULT_CLIENT_TIMEOUT,
    server_timeout: process.env.HAPROXY_DEFAULT_SERVER_TIMEOUT,
    write_interval: process.env.HAPROXY_WRITE_INTERVAL
}, {
    max_connections: 16384,
    connect_timeout: 30000,
    client_timeout: 30000,
    server_timeout: 30000,
    write_interval: 15000
});

var myriad_kv_client = new MyriadKVClient({
    host: config.myriad.host,
    port: config.myriad.port
});

var haproxy = {

    config_file: "haproxy.conf",

    checksum: null,

    write_config: function(fn){
        var self = this;

        this.get_content(function(err, content){
            if(err)
                return fn(err);

            var checksum = crypto.createHash("md5").update(content).digest("hex");

            if(checksum != self.checksum){
                fs.writeFile(haproxy.config_file, content, function(err){
                    if(err)
                        return fn(err);

                    self.checksum = checksum;

                    if(_.isUndefined(self.process))
                        self.start();
                    else
                        self.reload();

                    return fn();
                });
            }
        });
    },

    get_content: function(fn){
        var content = [
            template.global(config.haproxy),
            template.defaults(config.haproxy)
        ]

        async.parallel({
            hosts: myriad.get_hosts,
            applications: myriad.get_applications
        }, function(err, response){
            if(err)
                return fn(err);

            _.each(response.applications, function(application){
                var listen_line = template.listen({
                    id: application.id,
                    port: application.discovery_port
                });

                content.push(listen_line);

                _.each(application.containers, function(container){
                    if(!_.isNull(container.host) && !_.isUndefined(container.host) && _.has(response.hosts, container.host) && container.status == "loaded"){
                        var server_line = template.server({
                            id: container.id,
                            ip: response.hosts[container.host].address.private,
                            port: container.host_port
                        });

                        content.push(server_line);
                    }
                });

                content.push("");
            });

            return fn(null, _.flatten(content).join("\n"));
        });
    },

    start: function(){
        this.process = child_process.spawn("haproxy", ["-f", "haproxy.conf", "-p", "/var/run/haproxy.pid"])
    },

    reload: function(){
        var pid = this.process.pid;
        this.process = child_process.spawn("haproxy", ["-f", "haproxy.conf", "-p", "/var/run/haproxy.pid", "-sf", pid])
    }

}

var myriad = {
    get_containers: function(application_name, fn){
        myriad_kv_client.keys(["containership", "containers", application_name, "*"].join("::"), function(err, keys){
            if(err)
                return fn(err);

            var containers = [];

            async.each(keys || [], function(key, fn){
                myriad_kv_client.get(key, function(err, container){
                    if(err)
                        return fn(err);

                    try{
                        container = JSON.parse(container);
                        containers.push(container);
                        return fn();
                    }
                    catch(err){
                        return fn(err);
                    }
                });
            }, function(err){
                if(err)
                    return fn(err);

                return fn(null, containers);
            });
        });
    },

    get_applications: function(fn){
        myriad_kv_client.keys(["containership", "application", "*"].join("::"), function(err, keys){
            if(err)
                return fn(err);

            var applications = [];

            async.each(keys || [], function(key, fn){
                myriad_kv_client.get(key, function(err, application){
                    if(err)
                        return fn(err);

                    try{
                        application = JSON.parse(application);
                        myriad.get_containers(application.id, function(err, containers){
                            if(err)
                                return fn(err);

                            application.containers = containers;
                            applications.push(application);
                            return fn();
                        });
                    }
                    catch(err){
                        return fn(err);
                    }
                });
            }, function(err){
                if(err)
                    return fn(err);

                return fn(null, applications);
            });
        });
    },

    get_hosts: function(fn){
        myriad_kv_client.stat(function(err, stats){
            if(err)
                return fn(err);
            else
                return fn(null, stats.hosts);
        });
    }

}

haproxy.write_config(function(err){
    if(err)
        process.stderr.write(err.message);

    setInterval(function(){
        haproxy.write_config(function(err){
            if(err)
                process.stderr.write(err.message);
        });
    }, config.haproxy.write_interval);
});
