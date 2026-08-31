FROM postgis/postgis:16-3.5-alpine

RUN apk upgrade --no-cache \
    && apk add --no-cache gosu=1.19-r4 \
    && find /usr/local/bin -maxdepth 1 -name gosu -delete
COPY --chmod=0555 infra/docker/postgres-init.sh /docker-entrypoint-initdb.d/010-runtime-roles.sh
