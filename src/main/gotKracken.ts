import got from 'got';

const PUBLIC_REST_URL = "https://api.kraken.com/0/public/";

const kracken = got.extend({ prefixUrl: PUBLIC_REST_URL, headers: { 
    "content-type": "application/json",
    "Accept-Encoding": "gzip"
} });

export default kracken;
