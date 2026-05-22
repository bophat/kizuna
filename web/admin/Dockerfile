FROM node:20-alpine

WORKDIR /app

COPY admin/package*.json ./
RUN npm install

COPY admin/ .
COPY shared ./shared

EXPOSE 3001

CMD ["npm", "run", "dev", "--", "--port=3001", "--host=0.0.0.0"]
