FROM nginx:1.11.1

MAINTAINER Containership Developers <developers@containership.io>

RUN echo "deb http://ftp.us.debian.org/debian wheezy-backports main" >> /etc/apt/sources.list
RUN apt-get update && apt-get install curl nodejs-legacy -y
RUN curl -L --insecure https://www.npmjs.org/install.sh | bash
RUN /usr/bin/npm install -g n && n 6.3.0

RUN rm -rf /etc/nginx/*
RUN mkdir /etc/nginx/stream.d
RUN mkdir /app
ADD . /app
WORKDIR /app
RUN npm install
CMD node index.js
