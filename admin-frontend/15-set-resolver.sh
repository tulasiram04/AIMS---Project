#!/bin/sh
RESOLVER_IP=$(grep nameserver /etc/resolv.conf | head -n1 | awk '{print $2}')
export RESOLVER_IP
