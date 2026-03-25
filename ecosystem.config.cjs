module.exports = {
  apps: [{
    name: 'area862',
    script: 'src/index.js',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '500M',
    env: {
      NODE_ENV: 'production',
      PORT: 5001
    },
    error_file: '/var/log/area862/error.log',
    out_file: '/var/log/area862/output.log',
    merge_logs: true,
    log_date_format: 'YYYY-MM-DD HH:mm:ss',
    restart_delay: 5000,
    kill_timeout: 5000
  }]
};
