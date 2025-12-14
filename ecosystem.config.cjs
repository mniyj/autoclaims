module.exports = {
  apps: [{
    name: "insurance-config-page",
    script: "./server.js",
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
        NODE_ENV: "production",
        PORT: 3005
    }
  }, {
    name: "insurance-config-page-3008",
    script: "./server.js",
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
        NODE_ENV: "production",
        PORT: 3008
    }
  }]
};
