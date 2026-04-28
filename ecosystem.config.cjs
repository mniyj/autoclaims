module.exports = {
  apps: [{
    name: "insurance-config-page",
    script: "./server.js",
    instances: 1,
    exec_mode: "fork",
    autorestart: true,
    watch: false,
    max_memory_restart: '180M',
    node_args: '--max-old-space-size=150',
    env: {
      NODE_ENV: "production",
      PORT: 3005,
      BASE_PATH: "/"
    }
  }]
};
