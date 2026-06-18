FROM alfg/nginx-rtmp

COPY nginx.conf /etc/nginx/nginx.conf

EXPOSE 1935
EXPOSE 8080

CMD ["nginx", "-g", "daemon off;"]

# docker build -t livestream-streaming .
# docker run -d \
# -p 1935:1935 \
# -p 8080:8080 \
# --name streaming-server \
# livestream-streaming