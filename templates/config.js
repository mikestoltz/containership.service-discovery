'use strict';

const _ = require('lodash');

module.exports = {

    defaults: {},

    render: function(options) {
        _.defaults(options, this.defaults);

        const config = _.map(options.applications, (application) => {
            const application_config = [
                `frontend=*,${application.discovery_port};no-tls`,
            ];

            _.forEach(application.containers, (container) => {
                application_config.push(`backend=${container.ip}:${container.port};;no-tls;proto=h2;fall=2;rise=2`);
            });

            application_config.push(`workers=${options.workers}`);
        })

        return _.flatten(config).join('/n');
    }

};
