'use strict';

const _ = require('lodash');

module.exports = {

    defaults: { workers: 8 },

    render: function(options) {
        _.defaults(options, this.defaults);

        const lb_ports = [];

        const config = _.map(options.applications, (application) => {
            const application_config = [];

            lb_ports.push(application.env_vars.GRPCLB_PORT);

            _.forEach(application.containers, (container) => {
                application_config.push(`backend=${container.ip},${container.port};${application.id}.${process.env.CS_CLUSTER_ID}.containership;;no-tls;proto=h2;fall=2;rise=2`);
            });

            return application_config.join('\n');
        });

        _.forEach(_.uniq(lb_ports), (port) => {
            config.unshift(`frontend=*,${port};no-tls`);
        });

        config.push('\nbackend=127.0.0.1,65535;;proto=h2;fall=2;rise=2');

        config.push(`\nworkers=${options.workers}`);

        return _.flatten(config).join('\n');
    }

};
