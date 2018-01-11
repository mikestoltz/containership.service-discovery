'use strict';

const myriad = require('./lib/myriad');
const nghttpx = require('./lib/nghttpx');

const _ = require('lodash');
const constants = require('containership.core.constants');
const semver = require('semver');

function start_nghttpx(callback) {
    nghttpx.write_config((err) => {
        if (err) {
            process.stderr.write(`${err.message}\n`);
        } else {
            nghttpx.start();
        }

        if(callback) {
            return callback();
        }
    });
}

start_nghttpx(() => {
    myriad.get_containership_version((err, version) => {
        // embedded myriad-kv version does not include 'subscribe' functionality
        // fall back to reloading on an interval
        if(err || semver.lt(version, '1.8.0')) {
            setInterval(start_nghttpx, process.env.NGHTTPX_RELOAD_INTERVAL || 15000);
        } else {
            const subscribers = {
                applications: myriad.subscribe(process.env.CONTAINERSHIP_APPLICATIONS_REGEX || constants.myriad.APPLICATIONS),
                containers: myriad.subscribe(process.env.CONTAINERSHIP_CONTAINERS_REGEX || constants.myriad.CONTAINERS)
            };

            let coalescing = false;

            // subscribe to changes in containership applications and containers namespaces
            _.forEach(subscribers, (subscriber/*, name*/) => {
                if(!subscriber) {
                    process.stderr.write('Myriad .subscribe() method does not exist!\n');
                    process.stderr.write('Are you running containership 1.8.0 or greater?\n');
                    process.exit(1);
                }

                subscriber.on('message', (message) => {
                    if(message.type === 'data') {
                        if(!coalescing) {
                            setTimeout(() => {
                                coalescing = false;
                                start_nghttpx();
                            }, process.env.MYRIAD_SUBSCRIBE_COALESCING_INTERVAL || 1000);

                            coalescing = true;
                        }
                    }
                });
            });
        }
    });
});
