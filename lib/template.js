module.exports = {

    global: function(options){
        return [
            "global",
            ["\tmaxconn", options.max_connections].join(" "),
            ""
        ]
    },

    defaults: function(options){
        return [
            "defaults",
            "\tlog 127.0.0.1 local0",
            "\tmode tcp",
            "\toption dontlognull",
            "\tretries 3",
            ["\ttimeout connect", options.connect_timeout].join(" "),
            ["\ttimeout client", options.client_timeout].join(" "),
            ["\ttimeout server", options.server_timeout].join(" "),
            ""
        ]
    },

    listen: function(options){
        return [
            ["listen ", options.id, " :", options.port].join(""),
            "\toption tcplog",
            "\tbalance leastconn"
        ]
    },

    server: function(options){
        return [
            ["\tserver", options.id, [options.ip, options.port].join(":")].join(" ")
        ]
    }

}
