'use strict';

const _ = require('lodash');

module.exports = {

    defaults: {
        proxy_connect_timeout: 30,
        proxy_timeout: 30
    },

    render: function(options) {
        _.defaults(options, this.defaults);

        return _.trim(`
server {
    listen ${options.application.discovery_port};
    proxy_connect_timeout ${options.proxy_connect_timeout}s;
    proxy_timeout ${options.proxy_timeout}s;
    proxy_pass ${options.application.id};
}

upstream ${options.application.id} {
    least_conn;
${options.application.containers.map(container => `    server ${container.ip}:${container.port};`).join('\n')}
}
        `);
    }

};
