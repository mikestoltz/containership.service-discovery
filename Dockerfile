FROM mikestoltz1/nghttpx:latest

MAINTAINER Containership Developers <developers@containership.io>

RUN mkdir /app
ADD . /app
WORKDIR /app
RUN npm install
CMD node index.js
