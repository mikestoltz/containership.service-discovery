'use strict';

const _ = require('lodash');

module.exports = {

    defaults: {
        worker_processes: 4,
        worker_connections: 512
    },

    render: function(options) {
        _.defaults(options, this.defaults);

        return _.trim(`
daemon off;

worker_processes ${options.worker_processes};
events {
    worker_connections ${options.worker_connections};
}

error_log stderr info;

stream {
    include /etc/nginx/stream.d/*.conf;
}
        `);
    }

};
