const xhr = new XMLHttpRequest();
xhr.onreadystatechange = function () {
    if (this.readyState === 4 && this.status === 200) {
        const json = JSON.parse(this.responseText);
        const price = json.prices?.mp?.lowest_price;
        const hasPrice = price && !Array.isArray(price);
        document.getElementById('mptfLink').innerText = 'Marketplace.tf' + `${hasPrice ? ` (${price})` : ''}`;
    }
};
const bptfQuery = document.getElementById('getMptfPrice').getAttribute('bptfQuery');
xhr.open('get', `https://api.backpack.tf/item/get_third_party_prices/${bptfQuery}`, true);
xhr.setRequestHeader('Content-Type', 'application/json');
xhr.setRequestHeader('User-Agent', navigator.userAgent + ' via autobot.tf');
xhr.send();
