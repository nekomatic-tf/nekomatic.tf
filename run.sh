#!/bin/sh

cp ./index.html /data/www/autobot.tf
cp -r ./assets /data/www/autobot.tf
cp -r ./assets /data/www/api.autobot.tf
cp -r ./assets /data/www/wiki.autobot.tf
cp -r ./errorPages /data/www/

echo "Done copy!"
