# Serves the site exactly the way GitHub Pages does, with nginx instead.
# Build:  docker build -t prat .
# Run:    docker run --rm -p 8080:80 prat     then open http://localhost:8080/k/

FROM nginx:1.27-alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY index.html 404.html /usr/share/nginx/html/
COPY k /usr/share/nginx/html/k

EXPOSE 80
