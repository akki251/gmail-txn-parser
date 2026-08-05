#!/bin/bash
cd "$(dirname "$0")"
node fetchAndParse.js
node fetchSms.js
