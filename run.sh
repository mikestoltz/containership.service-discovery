touch /var/log/haproxy.log
/etc/init.d/rsyslog start &
node containership-haproxy.js &
tail -f /var/log/haproxy.log
