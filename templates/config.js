'use strict';

const _ = require('lodash');

module.exports = {

    defaults: { workers: 8 },

    render: function(options) {
        _.defaults(options, this.defaults);

        const config = _.map(options.applications, (application) => {
            const application_config = [
                `frontend=*,${application.env_vars.GRPCLB_PORT};no-tls`,
            ];

            _.forEach(application.containers, (container) => {
                application_config.push(`backend=${container.ip},${container.port};;no-tls;proto=h2;fall=2;rise=2`);
            });

            application_config.push(`workers=${options.workers}\n`);

	    return application_config.join('\n');
        })

        return _.flatten(config).join('\n');
    }

};
