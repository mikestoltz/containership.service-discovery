'use strict';

const myriad = require('./myriad');
const templates = require('../templates');

const fs = require('fs');
const _ = require('lodash');
const async = require('async');
const child_process = require('child_process');

const NGHTTP2_CONF = '/nghttp2.conf';

module.exports = {

    write_config: function(write_config_callback) {
        let scope = 'private';

        if (process.env.CS_PROC_OPTS) {
            try {
                const proc_opts = JSON.parse(process.env.CS_PROC_OPTS);
                scope = proc_opts.legiond.network.public ? 'public' : 'private';
            } catch(err) {
                // process.stderr.write(`${err.message}\n`);
            }
        }

        async.parallel({
            hosts: myriad.get_hosts,
            applications: myriad.get_applications
        }, (err, response) => {
            if (err) {
                process.stderr.write(`${err.message}\n`);
                return write_config_callback(err);
            }

            const applications = _.map(response.applications, (application) => {
                if(!application.env_vars.GRPCLB_PORT) {
                    return;
                }

                application.containers = _.map(application.containers, (container) => {
                    const has_valid_host = container && container.host && response.hosts[container.host];
                    const is_loaded = container.status === 'loaded';
                    const container_health_checks_results = container && container.tags && container.tags.metadata && container.tags.metadata.health_checks || [];
                    const healthy_checks = _.filter(container_health_checks_results, (health_check) => {
                        return health_check.is_healthy;
                    });
                    const all_health_checks_healthy = healthy_checks.length === container_health_checks_results.length;

                    const is_healthy = !application.health_checks || application.health_checks.length === 0 || all_health_checks_healthy;

                    if (has_valid_host && is_loaded && is_healthy) {
                        return {
                            ip: response.hosts[container.host].address[scope],
                            port: container.host_port
                        };
                    }
                });

                application.containers = _.compact(application.containers);

                return application;
            });

            fs.writeFile(NGHTTP2_CONF, templates.config.render({
                applications: _.compact(applications)
            }), (err) => {
                if(err) {
                    process.stderr.write(`${err.message}\n`);
                }

                return write_config_callback();
            });
        });
    },

    start: function() {
        if (this.process) {
            process.stdout.write('Reloading nghttpx process ...\n');
            // process.kill(this.process.pid, 'SIGHUP');
        } else {
            process.stdout.write('Starting nghttpx process ...\n');
            this.process = child_process.spawn('nghttpx', ['--conf', NGHTTP2_CONF]);

            this.process.stdout.on('data', (data) => {
                process.stdout.write(data);
            });

            this.process.stderr.on('data', (data) => {
                process.stderr.write(data);
            });
        }
    }

};
