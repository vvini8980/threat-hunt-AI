#!/bin/bash
set -e

# Update and install dependencies
sudo apt update
sudo apt install -y python3-pip python3-venv nginx certbot python3-certbot-nginx

# Setup Python Virtual Environment
cd /home/ubuntu/threat-hunt-AI/backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Setup Systemd Service
sudo cp deploy/threat-hunt-backend.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl start threat-hunt-backend
sudo systemctl enable threat-hunt-backend

# Setup Nginx
# NOTE: Edit nginx.conf to replace your_domain_or_ip with actual domain before running this
sudo cp deploy/nginx.conf /etc/nginx/sites-available/threat-hunt-backend
sudo ln -s /etc/nginx/sites-available/threat-hunt-backend /etc/nginx/sites-enabled/ || true
sudo rm -f /etc/nginx/sites-enabled/default
sudo systemctl restart nginx

echo "Setup complete! Please configure Certbot manually by running:"
echo "sudo certbot --nginx -d your_domain.com"
