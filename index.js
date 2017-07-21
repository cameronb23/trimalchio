function log(msg, type) {
    switch (type) {
        case "warning":
            console.warn(msg);
            break;
        case "error":
            console.error(msg);
            break;
        case "info":
            console.info(msg);
            break;
        default:
            console.log(msg);
    }
}

var dev = false;
var prompt = require('prompt');
var j = require('request').jar();
var states = require('./states.json');
var request = require('request').defaults({
    timeout: 10000,
    jar: j
});
var _ = require('underscore');
var cheerio = require('cheerio');
var phoneFormatter = require('phone-formatter');
//var Nightmare = require('nightmare');
//var wait = require('nightmare-wait-for-url');
var http = require('http');
var fs = require('fs');
var menu = require('node-menu');

var Bot,
    slackBot;


// INIT PROXIES - NEED TO LOAD PROXIES
var proxies = [];
var reader = require('readline').createInterface({ input: fs.createReadStream('proxies.txt') });

reader.on('line', (line) => {
  proxies.push(formatProxy(line));
});

function formatProxy(str) {
  // TODO: format is ip:port:user:pass
  let data = str.split(':');

  if(data.length === 2) {
    return "http://" + data[0] + ":" + data[1];
  } else if(data.length === 4) {
    return "http://" + data[2] + ":" + data[3] + "@" + data[0] + ":" + data[1];
  } else {
    console.log("Unable to parse proxy");
    return null;
  }
}

init();

function init() {
    if (fs.existsSync('./config.json')) {
        log('Found an existing config.json, using data from file for current process.', 'warning');
        config = require('./config.json');
        base_url = config.base_url
        startMenu();
    } else {
        prompt.get([{
            name: 'base_url',
            required: true,
            description: 'Store URL (ex: "https://store.illegalcivilization.com" or provide sitemap url)'
        }, {
            name: 'keywords',
            required: true,
            description: 'Keyword(s)'
        },{
            name: 'sizeStyle1',
            required: false,
            description: 'Usually is the size of the item but in some cases it could be the style. (Optional)'
        },{
            name: 'sizeStyle2',
            required: false,
            description: 'Usually is left blank, but if not it is usually the style of the item. (Optional)'
        },{
            name: 'ccn',
            required: true,
            description: 'CC Number (with spaces)'
        }, {
            name: 'nameOnCard',
            required: true,
            description: 'Name on CC'
        }, {
            name: 'month',
            type: 'integer',
            required: true,
            description: 'CC Exp Month (ex: 3, 6, 12)'
        }, {
            name: 'year',
            type: 'integer',
            required: true,
            description: 'CC Exp Year (ex: 2019)'
        }, {
            name: 'ccv',
            required: true,
            description: 'CVV Number on Card (ex: 810)'
        }, {
            name: 'firstName',
            required: true,
            description: 'First Name'
        }, {
            name: 'lastName',
            required: true,
            description: 'Last Name'
        }, {
            name: 'address',
            required: true,
            description: 'Address'
        }, {
            name: 'city',
            required: true,
            description: 'City'
        }, {
            name: 'state',
            required: true,
            description: 'State (ex: MA, CA, NY)'
        }, {
            name: 'zipCode',
            required: true,
            description: 'Zip Code'
        }, {
            name: 'phoneNumber',
            required: true,
            description: 'Phone Number (no spaces or symbols)'
        }, {
            name: 'email',
            required: true,
            description: 'Email Address'
        }, {
            name: 'shipping_pole_timeout',
            type: 'integer',
            required: true,
            description: 'Timeout Delay (ms) for polling shipping Rates (Recommended: 2500)'
        }], function(err, result) {


            var slack = {
                active: false,
                token: "token goes here",
                channel: "general",
                settings: {
                    username: "Trimalchio",
                    icon_url: "http://i.imgur.com/06ubORD.jpg"
                }
            }
            const ogKwValue = result.keywords;
            var ogSizeStyle1, ogSizeStyle2;
            if (result.sizeStyle1 == "") {
              ogSizeStyle1 = null;
            } else {
              ogSizeStyle1 = [result.sizeStyle1]
            }

            if (result.sizeStyle2 == "") {
              ogSizeStyle2 = null;
            } else {
              ogSizeStyle2 = [result.sizeStyle2]
            }

            result.sizeStyle1 = ogSizeStyle1
            result.sizeStyle2 = ogSizeStyle2;
            result.keywords = [ogKwValue];
            result.paypal = false;
            result.slack = slack;
            result.show_stock = false;
            config = result
            base_url = config.base_url

            fs.writeFile('config.json', JSON.stringify(result, null, 4), function(err) {
                log('Config file generated! Starting process...');
                log(`Seeking for Keyword(s)...`);
                startMenu();
            });
        });
    }
}

function startMenu() {

    var customHeader = `
                        888            d8b                        888          888      d8b
                        888            Y8P                        888          888      Y8P
                        888                                       888          888
                        888888 888d888 888 88888b.d88b.   8888b.  888  .d8888b 88888b.  888  .d88b.
                        888    888P"   888 888 "888 "88b     "88b 888 d88P"    888 "88b 888 d88""88b
                        888    888     888 888  888  888 .d888888 888 888      888  888 888 888  888
                        Y88b.  888     888 888  888  888 888  888 888 Y88b.    888  888 888 Y88..88P
                         "Y888 888     888 888  888  888 "Y888888 888  "Y8888P 888  888 888  "Y88P"

                                                  github.com/dzt/trimalchio

  `;
    menu.addItem('Basic Mode', function() {
        log(`Looking for Keyword(s) matching "${config.keywords}"`);
        if (config.slack.active) {
            Bot = require('slackbots');
            slackBot = new Bot({
                name: config.slack.settings.username,
                token: config.slack.token
            });
            log('Slack Bot is currently enabled.', 'info');
            slackBot.on('start', function() {
                slackBot.postMessageToChannel(config.slack.channel, 'Trimalchio is currently active (▰˘◡˘▰)', config.slack.settings);
            })
            slackBot.on('error', function() {
                log('error', 'An error occurred while connecting to Slack, please try again.')
                return process.exit()
            })
        }
        start();
        menu.resetMenu();
    }).addItem('Early Link Mode', function() {
        log('Feature not yet available at the moment. Sorry for the inconvenience.', 'error');
        process.exit(1);
    }).addItem('Restock Mode', function() {
        log('Feature not yet available at the moment. Sorry for the inconvenience.', 'error');
        process.exit(1);
    }).addItem('Captcha Harvester', function() {
        log('Feature not yet available at the moment. Sorry for the inconvenience.', 'error');
        process.exit(1);
    }).addItem('Scheduler', function() {
        log('Feature not yet available at the moment. Sorry for the inconvenience.', 'error');
        process.exit(1);
    }).addItem('Proxies', function() {
        log('Feature not yet available at the moment. Sorry for the inconvenience.', 'error');
        process.exit(1);
    }).customHeader(function() {
        console.log('\x1b[36m%s\x1b[0m', customHeader);
    }).disableDefaultPrompt().start();

    require("console-stamp")(console, {
        colors: {
            stamp: "yellow",
            label: "cyan",
            metadata: "green"
        }
    });
}

var base_url;
var userAgent = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_12_4) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/57.0.2987.133 Safari/537.36'

prompt.message = 'Input';
var match,
    price,
    styleID,
    config,
    storeID,
    url,
    checkoutHost,
    checkoutID;

var nightmareCookies = [];

prompt.start({
    noHandleSIGINT: true
});

var index = 0;

function start() {
    if(index >= proxies.length) {
      index = 0;
    }

    findItem(config.keywords, proxies[index], function(err, res) {
        if (err) {
            setTimeout(() => {
              return start();
            }, 10000); // delay
        } else {
            match = res;
            if ( config.base_url.endsWith(".xml") ) {
                base_url = base_url.replace("/sitemap_products_1.xml", '');
                request({
                    url: `${base_url}/products/${match.handle}.json`,
                    followAllRedirects: true,
                    method: 'get',
                    headers: {
                        'User-Agent': userAgent
                    }
                }, function(err, res, body) {
                    if (err) {
                        log('An error occured...', 'error');
                        process.exit(1);
                    } else {
                        var products = JSON.parse(body);
                        match = products.product;
                        selectStyle();
                    }
                });
            } else {
                selectStyle();
            }
        }
    });
}

var userHasBeenNotifiedEmpty = false;

function findItem(kw, proxy, cb) {

    if (config.base_url.endsWith(".xml")) {
        var parseString = require('xml2js').parseString;

        request({
            url: config.base_url,
            followAllRedirects: true,
            method: 'get',
            headers: {
                'User-Agent': userAgent
            },
            proxy: proxy
        }, function(err, res, body) {

            parseString(body, function(err, result) {
                if (err) {
                    log('An error occured trying to parse the sitemap', 'error');
                    start();
                    //process.exit(1);
                } else {

                    var products = result.urlset.url;

                    var foundItems = [];

                    let base = base_url.replace(/https:\/\//, '').replace(/.com\/sitemap_products_1.xml/, '');
                    for ( var i = 0; i < kw.length; i++ ) {
                        for ( var x = 0; x < products.length; x++ ) {
                            while ( products[x]["image:image"] == undefined ) { x++ }
                            let locTag = products[x].loc[0];
                            let imageTitle = products[x]["image:image"][0]["image:title"][0];
                            if ( imageTitle.toLowerCase().indexOf(kw[i].toLowerCase()) > -1 ) {
                                foundItems.push({title: imageTitle, handle: locTag.replace('https://' + base + '.com/products/', '')});
                            }
                        }
                    }

                    if (foundItems.length > 0) {
                        if (foundItems.length === 1) {
                            log(`Item Found! - "${foundItems[0].title}"`);
                            match = foundItems[0];
                            return cb(null, foundItems[0]);
                        } else {

                            log(`We found more than 1 item matching with the keyword(s) please select the item.\n`, 'warning');

                            for (var i = 0; i < foundItems.length; i++) {
                                log(`Product Choice #${i + 1}: "${foundItems[i].title}"`);
                            }

                            prompt.get([{
                                name: 'productSelect',
                                required: true,
                                description: 'Select a Product # (ex: "2")'
                            }], function(err, result) {
                                var choice = parseInt(result.productSelect);
                                match = foundItems[choice - 1];
                                log(`You selected - "${match.title}`);
                                return cb(null, match);
                            });

                        }
                    } else {
                        return cb('Match not found yet...', null);
                    }
                }
            });
        });
    } else {
        request({
            url: `${base_url}/products.json`,
            method: 'get',
            headers: {
                'User-Agent': userAgent
            },
            proxy: proxy
        }, function(err, res, body) {
            if (err) {
                log(err)
                return cb(err, null);
            } else {

                try {
                    var products = JSON.parse(body);
                } catch (e) {
                    if (res.statusCode == 430) {
                        log(`Shopify has timed out your connection temporally due to excessive traffic coming from your host.`, 'error');
                        process.exit(1);
                    } else {
                        log(`This site is incompatible, sorry for the inconvenience.`, 'error');
                        process.exit(1);
                    }
                }

                var foundItems = [];

                if (products.products.length === 0) {
                    if (userHasBeenNotifiedEmpty) {
                        return cb(true, null);
                    } else {
                        userHasBeenNotifiedEmpty = true;
                        log('No item\'s available right now still looking...', 'error');
                        return cb(true, null);
                    }
                }


                for (var i = 0; i < kw.length; i++) {
                  for (var x = 0; x < products.products.length; x++) {
                      var name = products.products[x].title;
                      if (name.toLowerCase().indexOf(kw[i].toLowerCase()) > -1) {
                          foundItems.push(products.products[x]);
                      }
                  }
                }

                if (foundItems.length > 0) {
                    if (foundItems.length === 1) {
                        log(`Item Found! - "${foundItems[0].title}"`);
                        match = foundItems[0];
                        return cb(null, foundItems[0]);
                    } else {


                        log(`We found more than 1 item matching with the keyword(s) please select the item.\n`, 'warning');

                        for (var i = 0; i < foundItems.length; i++) {
                            log(`Product Choice #${i + 1}: "${foundItems[i].title}"`);
                        }

                        prompt.get([{
                            name: 'productSelect',
                            required: true,
                            description: 'Select a Product # (ex: "2")'
                        }], function(err, result) {
                            var choice = parseInt(result.productSelect);
                            match = foundItems[choice - 1];
                            log(`You selected - "${match.title}`);
                            return cb(null, match);
                        });

                    }
                } else {
                    return cb('Match not found yet...', null);
                }

            }
        });
    }
}

var findVariantStock = function(handle, id, cb) {
    request({
        url: `${base_url}/products/` + handle + '.json',
        followAllRedirects: true,
        method: 'get',
        headers: {
            'User-Agent': userAgent
        }
    }, function(err, res, body) {

        try {
            var variants = JSON.parse(body).product.variants;
        } catch (e) {
            return cb(true, null);
        }

        var res = _.findWhere(variants, {
            id: id
        });
        if (res.inventory_quantity) {
            return cb(null, res.inventory_quantity);
        } else {
            return cb(null, 'Unavailable');
        }

    });
};

function selectStyle() {

    if (match.variants.length === 1) {

        var singleItemStock;
        styleID = match.variants[0].id;

        if (config.show_stock == false) {
            stock = 'Disabled'
        } else {
            findVariantStock(match.handle, match.variants[0].id, function(err, res) {
                if (err) {
                    singleItemStock = 'Unavailable'
                    log(`Style Selected: "${match.variants[0].option1}" (${styleID}) | Stock: Unavailable`);
                    pay();
                } else {
                    log(`Style Selected: "${match.variants[0].option1}" (${styleID}) | Stock: ${res}`);
                    pay();
                }
            });
        }

    } else {

        for (var i = 0; i < match.variants.length; i++) {
            var styleName = match.variants[i].option1;
            var option2 = match.variants[i].option2;

            var stock;
            if (config.show_stock == false) {
                stock = 'Disabled'
            } else {
                findVariantStock(match.handle, match.variants[i].id, function(err, res) {
                    if (err) {
                        stock = 'Unavailable'
                    } else {
                        stock = res;
                    }
                });
            }

            if (option2 == null) {
                log(`Style/Size Choice #${i + 1}: "${styleName}" | Stock: (${stock})`);
            } else {
                log(`Style/Size Choice #${i + 1}: "${styleName}" - ${option2} | Stock: (${stock}`);
            }
        }

        if (config.slack.active) {
            var styleoptions = [];
            for (var i = 0; i < match.variants.length; i++) {
                styleoptions.push({
                    "name": match.variants[i].option1,
                    "text": match.variants[i].option1,
                    "type": "button",
                    "value": match.variants[i].id
                })
            }

            var params = {
                "text": "Item Found! Select a Style...",
                "callback_id": "stylePick",
                "attachments": [{
                    "title": match.title,
                    "author_name": "Trimalchio",
                    "image_url": match.images[0].src,
                    "author_icon": config.slack.settings.icon_url
                }, {
                    "text": "Select a Style...",
                    "fallback": "Unable to choose a style",
                    "callback_id": "style",
                    "color": "#3AA3E3",
                    "attachment_type": "default",
                    "actions": styleoptions
                }]
            }
            slackBot.postMessage(config.slack.channel, null, params);
        }

        prompt.get([{
            name: 'styleSelect',
            required: true,
            description: 'Select a Style # (ex: "1")'
        }], function(err, result) {
            // Check if they have a second option open
            var choice = parseInt(result.styleSelect);
            styleID = match.variants[choice - 1].id;
            log(`You selected - "${match.variants[choice - 1].option1}" (${styleID})`);
            pay();
        });
    }
}

function pay() {
    request({
        url: `${base_url}/products/` + match.handle,
        followAllRedirects: true,
        method: 'get',
        headers: {
            'User-Agent': userAgent
        }
    }, function(err, res, body) {});

    request({
        url: `${base_url}/cart/add.js`,
        followAllRedirects: true,
        method: 'post',
        headers: {
            'Origin': base_url,
            'User-Agent': userAgent,
            'Content-Type': 'application/x-www-form-urlencoded',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Referer': base_url + '/products/' + match.handle,
            'Accept-Language': 'en-US,en;q=0.8'
        },
        formData: {
            'id': styleID,
            'qty': '1'
        }
    }, function(err, res, body) {
        request({
            url: `${base_url}/cart`,
            followAllRedirects: true,
            method: 'get',
            headers: {
                'User-Agent': userAgent
            }
        }, function(err, res, body) {
            log('Added to cart!');
            log('Checking out your item...');
            request({
                url: `${base_url}/cart`,
                followAllRedirects: true,
                method: 'post',
                headers: {
                    'User-Agent': userAgent
                },
                formData: {
                    'quantity': '1',
                    'checkout': 'Checkout'
                }
            }, function(err, res, body) {

                checkoutHost = 'https://' + res.request.originalHost

                if (res.request.href.indexOf('stock_problems') > -1) {
                    log(`This item is currently Sold Out, sorry for the inconvenience`);
                    process.exit(1);
                }

                var $ = cheerio.load(body);
                url = res.request.href
                checkoutID = url.split('checkouts/')[1];
                storeID = url.split('/')[3];
                var auth_token = $('form.edit_checkout input[name=authenticity_token]').attr('value');
                log(`Store ID: ${storeID}`)
                log(`Checkout ID: ${checkoutID}`)
                price = $('#checkout_total_price').text();
                slackNotification('#36a64f', 'Added to Cart');

                return input(auth_token);
            });
        });
    });
}

function input(auth_token) {
    log(`Checkout URL: ${url}`)

    if (url.indexOf('checkout.shopify.com') > -1) {
        log(`Checkout with checkout.shopify.com discovered`)
        var form = {
            'utf8': '✓',
            '_method': 'patch',
            'authenticity_token': auth_token,
            'previous_step': 'contact_information',
            'step': 'shipping_method',
            'checkout[email]': config.email,
            'checkout[buyer_accepts_marketing]': '1',
            'checkout[shipping_address][first_name]': config.firstName,
            'checkout[shipping_address][last_name]': config.lastName,
            'checkout[shipping_address][company]': '',
            'checkout[shipping_address][address1]': config.address,
            'checkout[shipping_address][address2]': '',
            'checkout[shipping_address][city]': config.city,
            'checkout[shipping_address][country]': 'US',
            'checkout[shipping_address][province]': config.state,
            'checkout[shipping_address][zip]': config.zipCode,
            'checkout[shipping_address][phone]': config.phoneNumber,
            'checkout[shipping_address][first_name]': config.firstName,
            'checkout[shipping_address][last_name]': config.lastName,
            'checkout[shipping_address][company]': '',
            'checkout[shipping_address][address1]': config.address,
            'checkout[shipping_address][address2]': '',
            'checkout[shipping_address][city]': config.city,
            'checkout[shipping_address][country]': 'United States',
            'checkout[shipping_address][province]': states[config.state],
            'checkout[shipping_address][zip]': config.zipCode,
            'checkout[shipping_address][phone]': config.phoneNumber,
            'checkout[remember_me]': '0',
            'button': '',
            'checkout[client_details][browser_width]': '979',
            'checkout[client_details][browser_height]': '631'
        }
    } else {
        var form = {
            'utf8': '✓',
            '_method': 'patch',
            'authenticity_token': auth_token,
            'previous_step': 'contact_information',
            'checkout[email]': config.email,
            'checkout[shipping_address][first_name]': config.firstName,
            'checkout[shipping_address][last_name]': config.lastName,
            'checkout[shipping_address][company]': '',
            'checkout[shipping_address][address1]': config.address,
            'checkout[shipping_address][address2]': '',
            'checkout[shipping_address][city]': config.city,
            'checkout[shipping_address][country]': 'United States',
            'checkout[shipping_address][province]': config.state,
            'checkout[shipping_address][province]': '',
            'checkout[shipping_address][province]': states[config.state],
            'checkout[shipping_address][zip]': config.zipCode,
            'checkout[shipping_address][phone]': config.phoneNumber,
            'checkout[remember_me]': '',
            'checkout[remember_me]': '0',
            'checkout[client_details][browser_width]': '979',
            'checkout[client_details][browser_height]': '631',
            'checkout[client_details][javascript_enabled]': '1',
            'step': 'contact_information'
        }
    }

    request({
        url: url,
        followAllRedirects: true,
        headers: {
            'Origin': `${checkoutHost}`,
            'User-Agent': userAgent,
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Referer': `${checkoutHost}/`,
            'Accept-Language': 'en-US,en;q=0.8'
        },
        method: 'get',
        qs: form
    }, function(err, res, body) {
        var $ = cheerio.load(body);
        return ship($('form.edit_checkout input[name=authenticity_token]').attr('value'));
    });
}

function ship(auth_token) {

    if (url.indexOf('checkout.shopify.com') > -1) {
        var form = {
            '_method': 'patch',
            'authenticity_token': auth_token,
            'button': '',
            'checkout[client_details][browser_width]': '979',
            'checkout[client_details][browser_height]': '631',
            'checkout[client_details][javascript_enabled]': '1',
            'checkout[email]': config.email,
            'checkout[shipping_address][address1]': config.address,
            'checkout[shipping_address][address2]': '',
            'checkout[shipping_address][city]': config.city,
            'checkout[shipping_address][country]': 'United States',
            'checkout[shipping_address][first_name]': config.firstName,
            'checkout[shipping_address][last_name]': config.lastName,
            'checkout[shipping_address][phone]': config.phoneNumber,
            'checkout[shipping_address][province]': states[config.state],
            'checkout[shipping_address][zip]': config.zipCode,
            'previous_step': 'contact_information',
            'remember_me': 'false',
            'step': 'shipping_method',
            'utf8': '✓'
        }
    } else {
        var form = {
            'utf8': '✓',
            '_method': 'patch',
            'authenticity_token': auth_token,
            'button': '',
            'checkout[email]': config.email,
            'checkout[shipping_address][first_name]': config.firstName,
            'checkout[shipping_address][last_name]': config.lastName,
            'checkout[shipping_address][company]': '',
            'checkout[shipping_address][address1]': config.address,
            'checkout[shipping_address][address2]': '',
            'checkout[shipping_address][city]': config.city,
            'checkout[shipping_address][country]': 'United States',
            'checkout[shipping_address][province]': states[config.state],
            'checkout[shipping_address][zip]': config.zipCode,
            'checkout[shipping_address][phone]': phoneFormatter.format(config.phoneNumber, "(NNN) NNN-NNNN"),
            'checkout[remember_me]': '0',
            'checkout[client_details][browser_width]': '979',
            'checkout[client_details][browser_height]': '631',
            'checkout[client_details][javascript_enabled]': '1',
            'previous_step': 'contact_information',
            'step': 'shipping_method'
        }
    }

    request({
        url: url,
        followAllRedirects: true,
        method: 'post',
        headers: {
            'Origin': `${checkoutHost}`,
            'Content-Type': 'application/x-www-form-urlencoded',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.8',
            'Referer': `${checkoutHost}/${storeID}/checkouts/${checkoutID}`,
            'User-Agent': userAgent
        },
        formData: form
    }, function(err, res, body) {
        var $ = cheerio.load(body);
        var shipping_pole_url = $('div[data-poll-refresh="[data-step=shipping_method]"]').attr('data-poll-target');
        if (shipping_pole_url === undefined) {
            var firstShippingOption = $('div.content-box__row .radio-wrapper').attr('data-shipping-method');
            if (firstShippingOption == undefined) {
                log(`${base_url} is Incompatible, sorry for the inconvenience. A browser checkout session will be opened momentarily.`);
                open(url);
                process.exit(1);
            } else {
                return submitShipping({
                    type: 'direct',
                    value: firstShippingOption,
                    auth_token: $('input[name="authenticity_token"]').val()
                });
            }
        }
        return submitShipping({
            type: 'poll',
            value: shipping_pole_url
        });
    });
}

function submitShipping(res) {

    /* RIP Nightmarejs lol
          log('Transfering Cookies over to headless session...');
          var cookies = JSON.stringify(j.getCookies('http://www.crapeyewear.com'));
          var parsedCookies = JSON.parse(cookies);
          log(`Number of Cookies discovered: ${parsedCookies.length}`)
          for (var i = 0; i < parsedCookies.length; i++) {
              if (parsedCookies[i].value === undefined) {
                  var val = ''
              } else {
                  var val = parsedCookies[i].value;
              }

              if (i != 7) {
                  nightmareCookies.push({
                      "url": 'http://www.crapeyewear.com',
                      "name": parsedCookies[i].key,
                      "value": val
                  });
              }
          }
          */

    // WTF IS THIS RETURNING A 202 (UPDATE: FIXED)

    if (res.type == 'poll') {
        log(`Shipping Poll URL: ${checkoutHost}${res.value}`);
        log(`Timing out Shipping for ${config.shipping_pole_timeout}ms`)

        setTimeout(function() {
            request({
                url: checkoutHost + res.value,
                method: 'get',
                headers: {
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                    'User-Agent': userAgent
                }
            }, function(err, res, body) {

                var $ = cheerio.load(body);

                var shipping_method_value = $('.radio-wrapper').attr('data-shipping-method');
                var auth_token = $('form[data-shipping-method-form="true"] input[name="authenticity_token"]').attr('value');

                log(`Shipping Method Value: ${shipping_method_value}`)
                log('Card information sending...');

                request({
                    url: url,
                    followAllRedirects: true,
                    method: 'post',
                    headers: {
                        'User-Agent': userAgent,
                        'Content-Type': 'application/x-www-form-urlencoded'
                    },
                    formData: {
                        'utf8': '✓',
                        '_method': 'patch',
                        'authenticity_token': auth_token,
                        'button': '',
                        'previous_step': 'shipping_method',
                        'step': 'payment_method',
                        'checkout[shipping_rate][id]': shipping_method_value
                    }
                }, function(err, res, body) {

                    var $ = cheerio.load(body);

                    var price = $('input[name="checkout[total_price]"]').attr('value');
                    var payment_gateway = $('input[name="checkout[payment_gateway]"]').attr('value');
                    var new_auth_token = $('form[data-payment-form=""] input[name="authenticity_token"]').attr('value');

                    // log(`Final Auth Token: ${new_auth_token}`);
                    // log(`Price: ${price}`);
                    // log(`Payment Gateway ID: ${payment_gateway}`);

                    submitCC(new_auth_token, price, payment_gateway);
                });
            });

        }, parseInt(config.shipping_pole_timeout));

    } else if (res.type == 'direct') {

        log(`Shipping Method Value: ${res.value}`)
        log('Card information sending...');

        request({
            url: url,
            followAllRedirects: true,
            method: 'post',
            headers: {
                'User-Agent': userAgent,
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            formData: {
                'utf8': '✓',
                '_method': 'patch',
                'authenticity_token': res.auth_token,
                'button': '',
                'previous_step': 'shipping_method',
                'step': 'payment_method',
                'checkout[shipping_rate][id]': res.value
            }
        }, function(err, res, body) {

            var $ = cheerio.load(body);
            var payment_gateway = $('input[name="checkout[payment_gateway]"]').attr('value');
            var new_auth_token = $('form[data-payment-form=""] input[name="authenticity_token"]').attr('value');

            log(`Price: ${price}`);
            log(`Payment Gateway ID: ${payment_gateway}`);

            submitCC(new_auth_token, price, payment_gateway);
        });
    }
}

function submitCC(new_auth_token, price, payment_gateway) {
    var ccInfo = {
        credit_card: {
            number: config.ccn,
            verification_value: config.ccv,
            name: config.firstName + ' ' + config.lastName,
            month: parseInt(config.month),
            year: parseInt(config.year)
        }
    }
    request({
        url: `https://elb.deposit.shopifycs.com/sessions`,
        followAllRedirects: true,
        method: 'post',
        headers: {
            'User-Agent': userAgent,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(ccInfo)
    }, function(err, res, body) {

        var sValue = JSON.parse(body).id;

        request({
            url: url,
            followAllRedirects: true,
            method: 'post',
            headers: {
                'Origin': checkoutHost,
                'Content-Type': 'application/x-www-form-urlencoded',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.8',
                'Referer': `${checkoutHost}/${storeID}/checkouts/${checkoutID}`,
                'User-Agent': userAgent
            },
            formData: {
                'utf8': '✓',
                '_method': 'patch',
                'authenticity_token': new_auth_token,
                'previous_step': 'payment_method',
                'step': '',
                's': sValue,
                'checkout[payment_gateway]': payment_gateway,
                'checkout[credit_card][vault]': 'false',
                'checkout[different_billing_address]': 'false',
                'checkout[billing_address][first_name]': config.firstName,
                'checkout[billing_address][last_name]': config.lastName,
                'checkout[billing_address][company]': '',
                'checkout[billing_address][address1]': config.address,
                'checkout[billing_address][address2]': '',
                'checkout[billing_address][city]': config.city,
                'checkout[billing_address][country]': 'United States',
                'checkout[billing_address][province]': states[config.state],
                'checkout[billing_address][zip]': config.zipCode,
                'checkout[billing_address][phone]': phoneFormatter.format(config.phoneNumber, "(NNN) NNN-NNNN"),
                'checkout[total_price]': price,
                'complete': '1',
                'checkout[client_details][browser_width]': '979',
                'checkout[client_details][browser_height]': '631',
                'checkout[client_details][javascript_enabled]': '1'
            }
        }, function(err, res, body) {

          if (dev) {
              fs.writeFile('debug.html', body, function(err) {
                  log('The file debug.html was saved the root of the project file.');
              });
          }
            var $ = cheerio.load(body);
            if ($('input[name="step"]').val() == 'processing') {
                log('Payment is processing, go check your email for a confirmation.');
                slackNotification('#36a64f', 'Payment is processing, go check your email for a confirmation.');
                setTimeout(function() {
                    return process.exit(1);
                }, 4500);
            } else if ($('title').text().indexOf('Processing') > -1) {
                log('Payment is processing, go check your email for a confirmation.');
                slackNotification('#36a64f', 'Payment is processing, go check your email for a confirmation.');
                setTimeout(function() {
                    return process.exit(1);
                }, 4500);
            } else if (res.request.href.indexOf('paypal.com') > -1) {
                slackNotification('#4FC3F7', `This website only supports PayPal and is currently incompatible with Trimalchio, sorry for the inconvenience. <${res.request.href}|Click Here>`);
                var open = require('open');
                log('This website only supports PayPal and is currently incompatible with Trimalchio, sorry for the inconvenience. A browser session with the PayPal checkout will open momentarily.');
                open(res.request.href);
                setTimeout(function() {
                    return process.exit(1);
                }, 3000);
            } else if ($('div.notice--warning p.notice__text')) {

                if ($('div.notice--warning p.notice__text') == '') {
                    slackNotification('#ef5350', 'An unknown error has occured.');
                    log(`An unknown error has occured please try again.`, 'error');
                    setTimeout(function() {
                        return process.exit(1);
                    }, 4500);
                } else {
                    slackNotification('#ef5350', `${$('div.notice--warning p.notice__text').eq(0).text()}`);
                    log(`${$('div.notice--warning p.notice__text').eq(0).text()}`, 'error');
                    setTimeout(function() {
                        return process.exit(1);
                    }, 4500);
                }

            } else {
                slackNotification('#ef5350', 'An unknown error has occured.');
                log(`An unknown error has occured please try again.`, 'error');
                setTimeout(function() {
                    return process.exit(1);
                }, 4500);
            }

        });
    });
}

function slackNotification(color, type) {
    if (config.slack.active) {
        var params = {
            username: config.slack.settings.username,
            icon_url: config.slack.settings.icon_url,
            attachments: [{
                "thumb_url": match.images[0].src,
                "fallback": match.title + ': ' + type,
                "title": match.title,
                "title_link": config.base_url + '/' + match.handle,
                "color": color,
                "fields": [{
                    "title": "Notification Message",
                    "value": type,
                    "short": "false"
                }, {
                    "title": "Checkout URL",
                    "value": `<${url}|Click Here>`,
                    "short": "false"
                }, {
                    "title": "Price",
                    "value": price,
                    "short": "false"
                }, {
                    "title": "Keyword(s)",
                    "value": config.keywords,
                    "short": "false"
                }],
                "footer": "Trimalchio",
                "ts": Math.floor(Date.now() / 1000),
                "footer_icon": "http://i.imgur.com/06ubORD.jpg"
            }]
        }
        slackBot.postMessage(config.slack.channel, null, params);
    }
}
