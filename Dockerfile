FROM haproxy:1.5.11

MAINTAINER Containership Developers <developers@containership.io>

RUN echo "deb http://ftp.us.debian.org/debian wheezy-backports main" >> /etc/apt/sources.list
RUN apt-get update && apt-get install curl nodejs-legacy rsyslog -y
RUN curl -L --insecure https://www.npmjs.org/install.sh | bash
RUN /usr/bin/npm install -g n && n 5.6.0

RUN mkdir /containership-haproxy
WORKDIR /containership-haproxy
ADD . .
RUN cp ./rsyslog/haproxy.conf /etc/rsyslog.d/haproxy.conf
RUN npm install
CMD ./run.sh
