'use strict';

const _ = require('lodash');
const async = require('async');
const MyriadKVClient = require('myriad-kv-client');
const os = require('os');

const interfaces = os.networkInterfaces();

let myriad_host = '127.0.0.1';
let cs_opts;

try{
    cs_opts = JSON.parse(process.env.CS_PROC_OPTS);
}
catch(err){
    cs_opts = {};
}

if (cs_opts.legiond && cs_opts.legiond.network && cs_opts.legiond.network.interface) {
    const iface = _.find(interfaces[cs_opts.legiond.network.interface], (iface) => {
        return iface.family === 'IPv4';
    });

    if (iface && iface.address) {
        myriad_host = iface.address;
    }
}

const myriad_kv_client = new MyriadKVClient({
    host: myriad_host,
    port: process.env.MYRIAD_PORT || 2666
});

const myriad = {

    get_containers: function(application_name, get_containers_callback) {
        myriad_kv_client.keys(`containership::containers::${application_name}::*`, (err, keys) => {
            if (err) {
                return get_containers_callback(err);
            }

            async.map(keys || [], (key, callback) => {
                myriad_kv_client.get(key, (err, container) => {
                    if (err) {
                        process.stderr.write(err.message);
                        return callback();
                    }

                    try {
                        container = JSON.parse(container);
                        return callback(null, container);
                    } catch(err) {
                        process.stderr.write(err.message);
                        return callback();
                    }
                });
            }, (err, containers) => {
                if (err) {
                    return get_containers_callback(err);
                }

                return get_containers_callback(null, containers);
            });
        });
    },

    get_applications: function(get_applications_callback) {
        myriad_kv_client.keys('containership::application::*', (err, keys) => {
            if (err) {
                process.stderr.write(err.message);
                return get_applications_callback();
            }

            async.map(keys || [], (key, callback) => {
                myriad_kv_client.get(key, (err, application) => {
                    if (err) {
                        process.stderr.write(err.message);
                        return callback();
                    }

                    try {
                        application = JSON.parse(application);
                        module.exports.get_containers(application.id, (err, containers) => {
                            if (err) {
                                process.stderr.write(err.message);
                                return callback();
                            }

                            application.containers = containers;
                            return callback(null, application);
                        });
                    } catch(err) {
                        process.stderr.write(err.message);
                        return callback();
                    }
                });
            }, get_applications_callback);
        });
    },

    get_hosts: function(get_hosts_callback){
        myriad_kv_client.stat((err, stats) => {
            if (err) {
                return get_hosts_callback(err);
            } else {
                return get_hosts_callback(null, stats.hosts);
            }
        });
    }

};

module.exports = myriad;
