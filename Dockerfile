FROM alpine:latest
ADD sh/ /sh
CMD [ "/sh/workload.sh" ]