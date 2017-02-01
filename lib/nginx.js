'use strict';

const myriad = require('./myriad');
const templates = require('../templates');

const fs = require('fs');
const _ = require('lodash');
const async = require('async');
const child_process = require('child_process');

const CONFIG_FILE = '/etc/nginx/nginx.conf';
const STREAMS_DIR = '/etc/nginx/stream.d';

module.exports = {

    write_config: function(write_config_callback) {
        function write_core(callback) {
            fs.stat(CONFIG_FILE, (err/*, stats*/) => {
                if (err) {
                    fs.writeFile(CONFIG_FILE, templates.core.render({
                        worker_processes: process.env.NGINX_WORKER_PROCESSES,
                        worker_connections: process.env.NGINX_WORKER_CONNECTIONS
                    }), callback);
                } else {
                    return callback();
                }
            });
        }

        function remove_old_streams(remove_old_streams_callback) {
            fs.readdir(STREAMS_DIR, (err, streams) => {
                if (err) {
                    process.stderr.write('Error fetching stream configurations!\n');
                    return remove_old_streams_callback();
                }

                async.each(streams || [], (stream, callback) => {
                    fs.unlink(`${STREAMS_DIR}/${stream}`, (err) => {
                        if (err) {
                            process.stderr.write(`${err.message}\n`);
                        }

                        return callback();
                    });
                }, remove_old_streams_callback);
            });
        }

        function write_new_streams(write_new_streams_callback) {
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
                    return write_new_streams_callback(err);
                }

                async.each(response.applications, (application, callback) => {
                    application.containers = _.map(application.containers, (container) => {
                        const has_valid_host = container && container.host && response.hosts[container.host];
                        const is_loaded = container.status === 'loaded';
                        const is_healthy = !application.health_check || application.health_check.length === 0 || (container && container.tags && container.tags.metadata && container.tags.metadata.health_check && container.tags.metadata.health_check.is_healthy);

                        if (has_valid_host && is_loaded && is_healthy) {
                            return {
                                ip: response.hosts[container.host].address[scope],
                                port: container.host_port
                            };
                        }
                    });

                    application.containers = _.compact(application.containers);
                    if (application.containers.length > 0) {
                        fs.writeFile(`${STREAMS_DIR}/${application.id}.conf`, templates.stream.render({
                            application: application,
                            proxy_write_timeout: process.env.NGINX_PROXY_WRITE_TIMEOUT,
                            proxy_timeout: process.env.NGINX_PROXY_TIMEOUT
                        }), (err) => {
                            if (err) {
                                process.stderr.write(`${err.message}\n`);
                            }

                            return callback();
                        });
                    } else {
                        return callback();
                    }
                }, write_new_streams_callback);
            });
        }

        async.series([write_core, remove_old_streams, write_new_streams], write_config_callback);
    },

    start: function() {
        if (this.process) {
            process.stdout.write('Reloading nginx process ...\n');
            process.kill(this.process.pid, 'SIGHUP');
        } else {
            process.stdout.write('Starting nginx process ...\n');
            this.process = child_process.spawn('nginx', ['-c', 'nginx.conf']);

            this.process.stdout.on('data', (data) => {
                process.stdout.write(data);
            });

            this.process.stderr.on('data', (data) => {
                process.stderr.write(data);
            });
        }
    }

};
