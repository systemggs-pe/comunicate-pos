FROM golang:1.24-alpine AS build
ARG MINIO_COMMIT=7aac2a2c5b7c882e68c1ce017d8256be2feea27f
RUN apk add --no-cache git ca-certificates
WORKDIR /src
RUN git init && git remote add origin https://github.com/minio/minio.git && git fetch --depth 1 origin ${MINIO_COMMIT} && git checkout --detach FETCH_HEAD
RUN CGO_ENABLED=0 go build -trimpath -o /minio .

FROM alpine:3.23
RUN apk add --no-cache ca-certificates curl && addgroup -g 10001 minio && adduser -D -u 10001 -G minio minio && mkdir /data && chown minio:minio /data
COPY --from=build /minio /usr/local/bin/minio
COPY --from=build /src/LICENSE /src/NOTICE /usr/share/licenses/minio/
USER minio
EXPOSE 9000 9001
ENTRYPOINT ["minio"]
