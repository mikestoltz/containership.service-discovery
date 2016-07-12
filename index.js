'use strict';

const nginx = require('./lib/nginx');

nginx.write_config((err) => {
    if (err) {
        process.stderr.write(`${err.message}\n`);
    } else {
        nginx.start();
    }

    setInterval(() => {
        nginx.write_config((err) => {
            if (err) {
                process.stderr.write(`${err.message}\n`);
            } else {
                nginx.start();
            }
        });
    }, process.env.NGINX_RELOAD_INTERVAL || 15000);
});
