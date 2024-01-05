function getQueryVariable(variable) {
	var query = window.location.search.substring(1);
	var vars = query.split('&');
	for (var i = 0; i < vars.length; i++) {
		var pair = vars[i].split('=');
		if (decodeURIComponent(pair[0]) == variable) {
			return decodeURIComponent(pair[1]);
		}
	}
	console.log('Query variable %s not found', variable);
	return false;
}

function formatCurrency(price) {
	return price.replace("US", "").replace(".00", "");
}

jQuery(function ($) {
	if(window.opener) {
		if( getQueryVariable('authcomplete') ) {
			window.opener.updateHeader();
		}
	}

	if( getQueryVariable('user_created') ) {
		$('#mm-subscription-complete-user-text-payment-success').removeClass('d-none');
	}
});

function updateHeader() {
	if(window.authWin) { window.authWin.close();}
	console.log("redirect: ", getQueryVariable('redirect'));
	
	if( getQueryVariable('redirect') ) {
		window.location.href = MM.urls.baseurl + getQueryVariable('redirect');
		return;
	}

	$.get('/api/editor/userinfo', function(user) {
		window.MM.user.id = user.id ? user.id : null;
		window.MM.user.email = user.email ? user.email : null;
		window.MM.user.marketing_consent = user.marketing_consent ? user.marketing_consent : false;
		// Check if mockup editor is loaded, if so then update state in editor
		if (window.MM_Mockup_Editor && window.MM_Mockup_Editor.login) {
			window.MM_Mockup_Editor.login(user)
		}
	});

	$('.main-header > .container').load(window.location.href + ' .main-header > .container > *', function(response, status, xhr) {
		$('#ldSignupModal').modal('hide');
		$('#ldLoginModal').modal('hide');
	});
}

$(document).ready(function() {
  window.setCookie = function(cname, cvalue, exdays) {
    var d = new Date();
    d.setTime(d.getTime() + exdays * 24 * 60 * 60 * 1000);
    var expires = 'expires=' + d.toUTCString();
    document.cookie = cname + '=' + cvalue + ';' + expires + ';path=/';
  };

  window.getCookie = function(cname) {
    var name = cname + '=';
    var ca = document.cookie.split(';');
    for (var i = 0; i < ca.length; i++) {
      var c = ca[i];
      while (c.charAt(0) == ' ') {
        c = c.substring(1);
      }
      if (c.indexOf(name) == 0) {
        return c.substring(name.length, c.length);
      }
    }
    return '';
  };

});


// PADDLE

// Paddle setup
jQuery(function ($) {
	if (window.Paddle) {
		Paddle.Setup({
			vendor: MM.paddle.VENDOR_ID,
			debug: false,
			eventCallback: function(data) {
				if(data.eventData.product.id === MM.paddle.mockup_api) {
					updateMockupAPIPrices(data);
				}
			}
		});
	}
});

function updateMockupAPIPrices(data) {
	var currencyLabels = document.querySelectorAll(".currency");
	var subtotal = data.eventData.checkout.prices.customer.total - data.eventData.checkout.prices.customer.total_tax;

	for(var i = 0; i < currencyLabels.length; i++) {
		currencyLabels[i].innerHTML = data.eventData.checkout.prices.customer.currency + " ";
	}

	document.getElementById("subtotal").innerHTML = subtotal.toFixed(2);
	document.getElementById("tax").innerHTML = data.eventData.checkout.prices.customer.total_tax;
	document.getElementById("total").innerHTML = data.eventData.checkout.prices.customer.total;

	if (data.eventData.checkout.recurring_prices) {
		var recurringCurrency = data.eventData.checkout.recurring_prices.customer.currency;
		var recurringTotal = data.eventData.checkout.recurring_prices.customer.total;
		var intervalType = data.eventData.checkout.recurring_prices.interval.type;
		var intervalCount = data.eventData.checkout.recurring_prices.interval.length;

		if(intervalCount > 1) {
		var recurringString = '<div class="is-line-label">Then</div><div class="is-line-value">'+recurringCurrency+" "+recurringTotal+" / "+intervalCount+" "+intervalType+"s</div>";
		}
		else {
		var recurringString = '<div class="is-line-label">Then</div><div class="is-line-value">'+recurringCurrency+" "+recurringTotal+" / "+intervalType+"</div>";
		}

		// document.getElementById("recurringPrice").innerHTML = recurringString;
	}
}

// Paddle show order details

jQuery(function ($) {
	$('.trigger-paddle-checkout-details').on('click', function (e) {
		e.preventDefault();
		var checkout_id = $(this).data('checkout-details');
		// create modal, if no modal, show Paddle default details popup

		Paddle.Order.DetailsPopup(checkout_id);
	});
});

// Paddle Pricing section actions

jQuery(function ($) {

	// define subs
	var subs = {
		month: {
			id: MM.paddle.subscription.month, //553683, //541051,
			net: 19
		},
		annual: {
			id: MM.paddle.subscription.annual, //553682, //547205, //546029,
			net: 190
		}
	};

	$(document).ready(function () {
		$('.paddle-open-checkout').each(function (i, obj) {
			var btn = $(this);
			if (btn.data('sub-type') == "day_ticket") {
				btn.data('product-id', MM.paddle.day_ticket)
			}
		})

		if (getQueryVariable('open_checkout') && !getQueryVariable('redirect')) {
			var id = getQueryVariable('open_checkout');
			openCheckout(id);
		}

	});

	$('.paddle-open-checkout').on('click', function (e) {
		var isEditorPage = $(this).data('is-design-editor');
		var id = parseInt($(this).data('product-id'));

		var type = $(this).data('sub-type');
		var coupon = $(this).data('coupon') || null;
		openCheckout(id, type, coupon, isEditorPage);

		if(isEditorPage) {
			$('#ldModalSelectAccount2').modal('hide');
			$('#mmEffectsDownloadModal').modal('hide');
		}

	});

	$('.subscription-choice').on('click', function (e) {
		var _val = "annual";
		if( $(this)[0].checked ) {
			_val = "annual";
		}else{
			_val = "month";
		}
		activeSubscription = _val;
		// $($(this).data('btn')).data('product-id', subs[activeSubscription].id);
		changeActiveSubscription(activeSubscription);
	});

	var activeSubscription = "annual";
	var monthAnnualSalePercent = 0;

	function openCheckout(id, type, coupon, isEditorPage) {
		// TODO: Check if user already is subscriber

		var type = type || 'subscription';
		var isEditorPage = isEditorPage || false;
		var coupon = coupon || false;
		// if not logged in, open modal
		let userEmail = MM.user.email;
		let userId = MM.user.id;
		let marketing_consent = Boolean(parseInt(MM.user.marketing_consent));
		if(window.gtag) {
			gtag('event', 'begin_checkout', {
				dimension3: activeSubscription,
				coupon: coupon || '',
				items: [
					{
						id: id,
						name: 'Subscription',
						category: 'Subscriptions',
						list_name: 'Editor',
						variant: type,
						quantity: 1,
					}
				]
			});
		}

		if(isEditorPage) {
			$('#ldModalSelectAccount2').modal('hide');
			$('#mmEffectsDownloadModal').modal('hide');
		}

		var ga_cid = null;
		if(window.ga && window.ga.getAll) {
			try {
				ga_cid = ga.getAll()[0].get('clientId');
			}catch(e) {
				console.error(e);
			}
		}
		var pass = "{\"type\": \"" + type + "\", \"ga_cid\": \"" + ga_cid + "\"}";

		var checkoutOptions = {
			product: id,
			passthrough: pass,
			marketingConsent: marketing_consent,
			successCallback: function (data) {
				$('#ldModalSubscriptionPending').modal();
				
				if(window.fbq) {
					fbq('track', 'Subscribe', {
						value: data.checkout.prices.vendor.total,
						currency: 'USD',
						subscription_id: id,
					});
				}
				
				window.trackConversion(data);

				// Refersion tracking
				if (window.r) {								
					const rfsn = {
						cart: data.checkout.id,
						id: localStorage.getItem("rfsn_v4_id"),
						url: window.location.href,
						aid: localStorage.getItem("rfsn_v4_aid"),
						cs: localStorage.getItem("rfsn_v4_cs")
					};
					r.sendCheckoutEvent(rfsn.cart, rfsn.id, rfsn.url, rfsn.aid, rfsn.cs);
				} else {
					console.log('Refersion tracking not enabled');
				}

				getOrderData(data.checkout.id, function(response) {
					
					if(response) {
						if(isEditorPage) {
							$('#ldModalSubscriptionPending').modal('hide');
							$('#ldModalSubscriptionComplete').modal();
							updateHeader();
							// TODO: gtm event
							window.dataLayer.push({
								'event': 'new_subscription',
								'event_action': 'pro',
								'subscription_plan': id,
								'subscription_type': 'pro',
								'user_id': MM.user.id,
								'value': data.checkout.prices.vendor.total - data.checkout.prices.vendor.total_tax
							})
						}else{
							if(!userId) {
								$.ajax({
									'method': 'POST',
									'url': '/api/paddle/login-checkout',
									'data': {
										checkout_id: data.checkout.id
									},
									'success': function(_response) {
										// TODO: gtm event
										updateHeader();
										window.dataLayer.push({
											'event': 'new_subscription',
											'event_action': 'pro',
											'subscription_plan': id,
											'subscription_type': 'pro',
											'user_id': window.MM.user.id,
											'value': data.checkout.prices.vendor.total - data.checkout.prices.vendor.total_tax
										})
										window.location.href = "/payment-success?user_created=1";
									},
									'error': function(err) {
										console.error(err);
									}
								});
								
							}else{
								// TODO: gtm event
								window.dataLayer.push({
									'event': 'new_subscription',
									'event_action': 'pro',
									'subscription_plan': id,
									'subscription_type': 'pro',
									'user_id': window.MM.user.id,
									'value': data.checkout.prices.vendor.total - data.checkout.prices.vendor.total_tax
								})
								window.location.href = "/payment-success";
							}
							
						}
					}else{
						$('#ldModalSubscriptionPending').modal('hide');
						$('#ldModalSubscriptionFailed').modal();
					}
				});

			}
		}

		if(window.MM.user.email) {
			checkoutOptions.email = window.MM.user.email;
		}
		if (coupon) {
			checkoutOptions.coupon = coupon;
		}

		Paddle.Checkout.open(checkoutOptions);
	}

	function getOrderData(id, cb) {
		
		Paddle.Order.details(id, function(response) {
			if(response.state == "processed") {
				cb(true);
			}else if(response.state === "processing") {
				console.log("processing order ...");
				setTimeout(function() {
					getOrderData(id, cb);
				}, 1000);
				
			}else {
				console.log("Order incomplete");
				setTimeout(function() {
					getOrderData(id, cb);
				}, 1000);
				// cb(false);
			}
		});
	}
	window.mm_get_order_data = getOrderData;

	function priceToNumber(price) {
		if (price && typeof price == "number") {
			price = "$" + price;
		}
		if (price && typeof price == "string") {
			price = price.replace(/,/gi, "");
		}
		for (var i = 0; i < price.length; i++) {
			var c = price[i];
			if (c >= '0' && c <= '9') {
				return { price: parseFloat(price.substr(i)), currency: price.substr(0, i) };
			}
		}
		return { price: 0, currency: "$" };
	}
	function getMonthlyNetPrice(activeSubscription) {
		var active = activeSubscription;
		if (active === "month") {
			return formatCurrency(subs[active].net);
		} else if (active === "annual") {
			var priceObj = priceToNumber(subs[active].net);
			var annualPrice = priceObj.price;
			var currency = priceObj.currency;
			var monthlyNumber = (annualPrice / 12).toFixed(2);
			monthlyNumber = monthlyNumber !== "0" ? monthlyNumber : "8.25";
			return currency + monthlyNumber;
		}
	}

	function getYearlyNetPrice(activeSubscription) {
		var active = activeSubscription;
		var priceObj = priceToNumber(subs[active].net);
		var finalPrice = "";
		if (active === "month") {
			var monthPrice = priceObj.price;
			var yearlyNumber = (monthPrice * 12).toFixed(0);
			yearlyNumber = yearlyNumber !== "0" ? yearlyNumber : "120";
			finalPrice = formatCurrency(priceObj.currency + yearlyNumber);
		} else if (active == "annual") {
			finalPrice = formatCurrency(priceObj.currency + priceObj.price);
		}
		return finalPrice;
	}

	function changeActiveSubscription(activeSubscription) {
		if(activeSubscription == 'annual') {
			$('.mm-annual-sale-feature').removeClass("d-none");
			$('.mm-billed-interval-feature').html('Billed annually (' + getYearlyNetPrice(activeSubscription) + ').');
		}else{
			$('.mm-annual-sale-feature').addClass("d-none");
			$('.mm-billed-interval-feature').html('Billed monthly.');
		}
		$('.subscription-monthly-net-price').html( activeSubscription === 'annual' ? getMonthlyNetPrice(activeSubscription) : getMonthlyNetPrice(activeSubscription) );
		$('.subscription-annual-net-price').html(activeSubscription === 'annual' ? '<br />' : '$276 per year');
		$('.subscription-interval').html( activeSubscription === 'annual' ? 'year' : 'mo' );
		$('.mm-monthly-subscription-year-price').html( getYearlyNetPrice('month') );
		$('#mm-subscription-btn').attr('data-product-id', subs[activeSubscription].id);
	}

	function getMonthAnnualSalePercent(activeSubscription) {
		Paddle.Product.Prices(subs.month.id, function (prices) {
			subs.month.net = formatCurrency(prices.price.net);

			Paddle.Product.Prices(subs.annual.id, function (prices) {
				subs.annual.net = formatCurrency(prices.price.net);
				var masp = 100 - (((priceToNumber(subs.annual.net).price / 12) / priceToNumber(subs.month.net).price) * 100);
				masp = Math.round(masp) + "%";
				monthAnnualSalePercent = masp;
				$('.subscription-annual-sale-percent').html(monthAnnualSalePercent);
				monthlyNetPrice = getMonthlyNetPrice(activeSubscription);
				$('.subscription-monthly-net-price').html(getMonthlyNetPrice(activeSubscription));
				// $('.subscription-annual-net-price').html(activeSubscription === 'annual' ? '$144' : '$288');
				$('.subscription-monthly-net-price').html( activeSubscription === 'annual' ? getMonthlyNetPrice(activeSubscription) : getMonthlyNetPrice(activeSubscription) );
				$('.subscription-annual-net-price').html(activeSubscription === 'annual' ? '<br />' : '$276 per year');
				$('.subscription-interval').html( activeSubscription === 'annual' ? 'year' : 'mo' );
			});
		});
	}
	$(document).ready(function () {
		if (window.Paddle) {

			// for each .mm-subscription-plan-price
			// get prices (net) (month, annual and one-time)
			$('.mm-subscription-plan-price').each(function(idx, obj) {
				var plan = $(obj).data('plan');

				// pro
				if(plan === "pro") {
					Paddle.Product.Prices(MM.paddle.subscription.month, function(prices) {
						// prices.price.net
						$(obj).attr('data-month-price-month', formatCurrency(prices.price.net) );
					})
					Paddle.Product.Prices(MM.paddle.subscription.annual, function(prices) {
						// prices.price.net
						$(obj).attr('data-year-price', formatCurrency(prices.price.net) );
						var annual_price = priceToNumber(prices.price.net);
						var monthly_price = annual_price.currency + (annual_price.price / 12).toFixed(2);
						
						$(obj).attr('data-month-price-year', monthly_price);
						$(obj).html(monthly_price);
					})
				}

				// team
				if(plan === "team") {
					Paddle.Product.Prices(MM.paddle.team_subscription.month, function(prices) {
						// prices.price.net
						var monthly_price = priceToNumber(prices.recurring.price.net);
						var final_price = monthly_price.currency + (monthly_price.price * 5);
						$(obj).attr('data-month-price-month', formatCurrency(final_price) );
					})
					Paddle.Product.Prices(MM.paddle.team_subscription.annual, function(prices) {
						// prices.price.net
						var annual_price = priceToNumber(prices.recurring.price.net);
						var monthly_price = annual_price.currency + ((annual_price.price * 5) / 12).toFixed(2);

						$(obj).attr('data-year-price', annual_price.currency + (annual_price * 5));

						$(obj).attr('data-month-price-year', formatCurrency(monthly_price) );
						$(obj).html( formatCurrency(monthly_price) );
					})
				}
				// TODO: annual offer
				if(plan === "pro-deal") {
					Paddle.Product.Prices(MM.paddle.subscription.annual_offer, function(prices) {
						// prices.price.net
						var annual_price = priceToNumber(prices.recurring.price.net);
						var monthly_price = annual_price.currency + (annual_price.price / 12).toFixed(2);
						$(obj).attr('data-month-price-year', formatCurrency(monthly_price) );
						$(obj).attr('data-month-price-month', formatCurrency(monthly_price) );
						$(obj).html( formatCurrency(monthly_price) );
					})
					
				}
				// TODO: one-time
			});


			getMonthAnnualSalePercent("annual");
			changeActiveSubscription("annual");

			var checkPriceFormating = function () {
				setTimeout(function () {
					var needToFormat = false;
					$('.paddle-net').each(function () {
						if ($(this).html()[0] == "$") {
							needToFormat = true;
						}
						$(this).html(formatCurrency($(this).html()))
					})
					if (needToFormat) {
						checkPriceFormating();
					}
				}, 100);
			}
			checkPriceFormating();

		}
	});

});

// Browse infinite content
function elemIsOnScreen(elem) {
	var element = document.querySelector(elem);
	if(!element) {
		return false;
	}
	var position = element.getBoundingClientRect();
	if (position.top >= 0 && position.bottom <= window.innerHeight) {								
		return true;									
	}		
	return false;
}

// Set variables
let mmHasMoreContent = true;
let handleLoadMoreContentTimeout = '';
let setContentLoadMoreEventsTimeout = '';

// Init load more events
jQuery(function ($) {	
	mmHasMoreContent = (!$('.mm-btn-load-more').length ? false : true);
	if (mmHasMoreContent != false) {
		$('.masonry-grid-item').imagesLoaded(function(){		
			setContentLoadMoreEvents();	
		});
	}else{
		$('.mm-request-mockup-cta').removeClass('d-none');
	}
});

// Set events
function setContentLoadMoreEvents() {
	window.clearTimeout(setContentLoadMoreEventsTimeout);	
	if (!mmHasMoreContent) {
		$('.masonry-grid').masonry();
		return false;
	}
	$('.mm-btn-load-more').on('click', function (event) {
		event.preventDefault();
		handleLoadMoreContent(event);
	});	
	handleLoadMoreContentScroller();	
}

// Handle scroll to view event
function handleLoadMoreContentScroller() {
	if (!mmHasMoreContent) {
		$('.masonry-grid').masonry();
		return false;
	}
	$(window).on('scroll', function(e) {
		if (elemIsOnScreen('.mm-btn-load-more:not(.mm-no-user)')) { 			
			$(window).off('scroll');
			handleLoadMoreContent(e);						
 		}	
	});
}

function handleLoadMoreContent(event) {
	event.preventDefault();	
	handleLoadMoreContentTimeout = window.setTimeout(function() {	
		window.clearTimeout(handleLoadMoreContentTimeout);			
		// Prep loader
		$('.masonry-grid').masonry();
		$('.mm-category-loader').removeClass('d-none');
		$('.mm-btn-load-more').addClass('disabled').text('Loading...');
		// Update url and load new page content
		const _currentPageInfo = new URLSearchParams(window.location.search);
		const _initialPage = _currentPageInfo.get('initPage') ? _currentPageInfo.get('initPage') : 1;
		const _nextPage = 1 + (_currentPageInfo.get('page') ? parseInt(_currentPageInfo.get('page')) : 1);
		_currentPageInfo.set('page', _nextPage);
		_currentPageInfo.set('initPage', _initialPage);
		_currentPageInfo.set('ajax', 1);
		window.history.replaceState({}, '', `${location.pathname}?${_currentPageInfo}#main`);
		$.ajax({
			url: `${location.pathname}?${_currentPageInfo}`,
			method: 'GET'
		})
		.done(function(data) {		 
			// const _currentPageInfo = new URLSearchParams(window.location.search);
			_currentPageInfo.set('ajax', 0);
			window.history.scrollRestoration = 'manual';
			window.history.replaceState({scrollTop: $(window).scrollTop()}, '', `${location.pathname}?${_currentPageInfo.toString()}#main`);
			// Check if there are more new items to show
			if (!$('.mm-btn-load-more', data).length) {			
				$('.mm-btn-load-more').addClass('d-none');
				$('.mm-request-mockup-cta').removeClass('d-none');
				mmHasMoreContent = false;
			}	
			// Prep and append to masonry
			var $addedItems = $('.masonry-grid-item:not(.masonry-grid-item-handpicked)', data).addClass('d-none');
			$addedItems.appendTo('.masonry-grid');		
			// Once loaded show and refresh loader events
			$addedItems.imagesLoaded(function(){		
				
				$addedItems.removeClass('d-none');
				$('.masonry-grid').masonry('appended', $addedItems);
				
				$('.mm-category-loader').addClass('d-none');	
				$('.mm-btn-load-more').removeClass('disabled').text('Load more');	
				setContentLoadMoreEventsTimeout = window.setTimeout(setContentLoadMoreEvents, 250);	
				$('.masonry-grid').masonry();	
			});
		});			
	}, 250);
	return false;
}


// Add validator methods

$.validator.addMethod("checkupper", function (value) {
	return /[A-Z]/.test(value);
});
$.validator.addMethod("checkdigit", function (value) {
	return /[0-9]/.test(value);
});
$.validator.addMethod("checkemail", function (email) {
	var tester = /^[-!#$%&'*+\/0-9=?A-Z^_a-z{|}~](\.?[-!#$%&'*+\/0-9=?A-Z^_a-z`{|}~])*@[a-zA-Z0-9](-?\.?[a-zA-Z0-9])*\.[a-zA-Z](-?[a-zA-Z0-9])+$/;
	if (!email) {
		return false;
	}
	if (email.length > 254) {
		return false;
	}
	var valid = tester.test(email);
	if (!valid) {
		return false;
	}
	// Further checking of some things regex can't handle
	var parts = email.split("@");
	if (parts[0].length > 64) {
		return false;
	}
	var domainParts = parts[1].split(".");
	if (domainParts.some(function (part) { return part.length > 63; })) {
		return false;
	}
	return true;
});

jQuery.validator.addMethod("alphanumeric", function(value, element) {
    return this.optional(element) || /^[\w.]+$/i.test(value);
}, "Letters and numbers only please");

// Login / Sign up forms
jQuery(function ($) {
	var signInForm = document.getElementById("signInForm");
	var registerForm = document.getElementById("register_form");

	function showToast(message, type = 'info', delay = 6000) {
		$('.toast-wrapper').css('pointer-events', 'all');
		$(`<div class="toast fade">
				<div class="alert alert-${type} m-0 border-0 d-flex">
						<div class="mr-5">${message}</div>
				</div>
			</div>`)
			.toast({ delay: delay, autohide: false })
			.appendTo('.toast-wrapper')
			.toast('show')
			.delay(delay)
			.fadeOut(200, function(){ $(this).remove() });
	}
	if(window.MM.Utils) {
		window.MM.Utils.showToast = showToast;
	}


	$('#mm_google_auth_signup').on('click', function (e) {
		checkTerms(e, $(this));
	});

	$('#mm_google_auth_signin').on('click', function (e) {
		e.preventDefault();
		var auth_url = $(this).data('auth-url');
		var redirect_to = $(this).data('redirect');
		window.authWin = window.open(auth_url + '?redirect=' + redirect_to);
	});

	$('#mm_facebook_auth_signin').on('click', function (e) {
		e.preventDefault();
		var auth_url = $(this).data('auth-url');
		var redirect_to = $(this).data('redirect');
		window.authWin = window.open(auth_url + '?redirect=' + redirect_to);
	});

	$('#mm_facebook_auth_register').on('click', function(e) {
		checkTerms(e, $(this));
	})

	function checkTerms(e, obj) {
		e.preventDefault();
		var check_passed = 0;
		var auth_url = obj.data('auth-url');
		var redirect_to = obj.data('redirect');
		if ($("#inputAgreeToTerms")[0].checked) {
			check_passed++;
			// $("#labelAgreeToPrivacy").remove("has-warning");
		} else {
			$("#labelAgreeToTerms").addClass("has-warning");
		}

		if ($("#inputMarketingConsent")[0].checked) {
			redirect_to += "&marketing_consent=1"
		}
		if (check_passed == 1) {
			window.authWin = window.open(auth_url + '?redirect=' + redirect_to);
			// window.location.href = redirect_to;
		} else {
			check_passed = 0;
			$("#checkbox_error").removeClass("d-none").html("<span>The following red checkbox(es) are required.</span>");
		}
	}

	$('#regLinkBtn').on('click', function (e) {
		registerFromModal();
	});

	$('#regLinkAppsumoBtn').on('click', function (e) {
		registerFromAppsumo();
	});

	$('#mm_modal_login_button').on('click', function (e) {
		signinFromModal();
	});

	$('#subscribe-to-newsletter').on('submit', function (e) {
		e.preventDefault();
		subscribeNewsletter($(this));
	});

	$('#subscribe-to-list').on('submit', function (e) {
		e.preventDefault();
		subscribeList();
	});

	$('#contactForm').on('submit', function (e) {
		e.preventDefault();
		submitContactForm();
	});

	function registerFromModal() {
		registerForm.action = "/register";
		$('#register_form').validate();
		if ($('#register_form').valid()) {
			//signInForm.submit();
			//grecaptcha.execute();
			submitRegisterFormAjax();
		} else {
			console.log("form not valid");
		}
	}

	function registerFromAppsumo() {
		$('#register_form_appsumo').validate();
		if ($('#register_form_appsumo').valid()) {
			//signInForm.submit();
			//grecaptcha.execute();
			submitRegisterFormAppsumoAjax();
		} else {
			console.log("form not valid");
		}
	}

	function subscribeNewsletter(form) {

		var $subscribeForm = $("#subscribe-to-newsletter"),
				$submitBtn = $subscribeForm.find("button[type=submit]"),
				$input  = $subscribeForm.find("input[name=email]");

		$subscribeForm.validate();
		if ($subscribeForm.valid()) {
			$submitBtn.prop("disabled", true);
			$.ajax({
				url: $subscribeForm.prop('action'),
				method: 'POST',
				data: $subscribeForm.serialize(),
				success: function (data) {
					if (data.error) {
						if (data.error.field == 'email') {
							$input.addClass('is-invalid');
						}
					}
					if (data.success) {
						showToast('Subscribed!', 'success');
						$input.val('');

						if(form.data('page') && form.data('page') == 'ebook') {
							$("#ebook-subscribe-newsletter-button").addClass("disabled").attr("disabled", true).text("Sent");
						}
					}
					$submitBtn.prop("disabled", false);
				},
				error: function (err) {
					var msg = 'Ooops! Something went wrong!';
					console.error(err);
					if(err.responseJSON) {
						msg = err.responseJSON.message;
					}
					$submitBtn.prop("disabled", false);
					showToast(msg, 'danger');
				}
			});
		} else {
			console.log('Email validation failed');
		}
	}

	function subscribeList() {
		var $subscribeForm = $("#subscribe-to-list"),
			$submitBtn = $subscribeForm.find("button[type=submit]"),
			$input  = $subscribeForm.find("input[name=email]");

		$subscribeForm.validate();
		if ($subscribeForm.valid()) {
			$submitBtn.prop("disabled", true);
			$.ajax({
				url: $subscribeForm.prop('action'),
				method: 'POST',
				data: $subscribeForm.serialize(),
				success: function (data) {
					if (data.error) {
						if (data.error.field == 'email') {
							$input.addClass('is-invalid');
						}
					}
					if (data.success) {
						showToast('Subscribed!', 'success');
						$input.val('');
					}
					$submitBtn.prop("disabled", false);
				},
				error: function (err) {
					$submitBtn.prop("disabled", false);
					showToast('Ooops! Something went wrong!', 'danger');
				}
			});
		} else {
			console.log('Email validation failed');
		}
	}

	function submitContactForm() {
		var $contactForm = $("#contactForm"),
				$submitBtn = $contactForm.find("button[type=submit]");
		$contactForm.validate();
		if ($contactForm.valid()) {
			$submitBtn.prop("disabled", true);
			$.ajax({
				url: $contactForm.prop('action'),
				method: 'POST',
				data: $contactForm.serialize(),
				success: function (data) {
					showToast('Message sent!', 'success');
					$("#contactForm")[0].reset();
					$submitBtn.prop("disabled", false);
				},
				error: function (err) {
					var data = err.responseJSON;
					if (data.errors) {
						showToast(data.errors[0], 'danger');
					} else {
						showToast('Ooops! Something went wrong!', 'danger');
					}
					$submitBtn.prop("disabled", false);
				}
			});
		} else {
			console.log('Email validation failed');
		}
	}

	//Add keyboard Enter support to sign up and sign in form
	var DOM_VK_RETURN = 13;
	$(document).on('keydown', function (e) {
		var code = e.keyCode || e.which;
		if (code == DOM_VK_RETURN) {
			if (($("#ldSignupModal").data('bs.modal') || {})._isShown) {
				registerFromModal();
			}
			if (($("#ldLoginModal").data('bs.modal') || {})._isShown) {
				signinFromModal();
			}
		}
	});

	function signinFromModal() {
		signInForm.action = "/login-123";
		$('#signInForm').validate();
		if ($('#signInForm').valid()) {
			//signInForm.submit();
			$("#loginFormError").html('').addClass('d-none');
			submitSignInFormAjax();
		}
	}

	function submitSignInFormAjax() {
		//$("#signinModal_overlay").show();
		$.ajax({
			url: '/login-123',
			method: 'POST',
			data: $("#signInForm").serialize(),
			success: function (data) {
				if (data.error) {
					if (data.error.field == 'user') {
						$("#login_inputEmail").addClass('is-invalid');
						$("#login_inputEmail + .invalid-feedback").html(data.error.message);
					} else if (data.error.field == 'password') {
						$("#login_inputPassword").addClass('is-invalid');
						$("#login_inputPassword + .invalid-feedback").html(data.error.message);
					}else{
						$("#loginFormError").html(data.error.message);
						$("#loginFormError").removeClass('d-none');
					}
					// $('#loginFormError')
					//     .removeClass('d-none')
					//     .html('<p>' + data.error + '</p>');
					//$('#signin_modal_error_text').text(data.error);
					//$("#signinModal_overlay").hide();
				}
				if (data.success) {
					if(data.design_editor || data.mockup_editor) {
						updateHeader();
					}else{
						window.location = data.redirect;
					}

				}else{
					if (data.error.field == 'user') {
						$("#login_inputEmail").addClass('is-invalid');
						$("#login_inputEmail + .invalid-feedback").html(data.error.message);
					} else if (data.error.field == 'password') {
						$("#login_inputPassword").addClass('is-invalid');
						$("#login_inputPassword + .invalid-feedback").html(data.error.message);
					}else{
						$("#loginFormError").html(data.error.message);
						$("#loginFormError").removeClass('d-none');
					}
				}
				//grecaptcha.reset();
			},
			error: function (err) {
				console.error(err);
				var data = err.responseJSON;
				if (data.error.field == 'user') {
					$("#login_inputEmail").addClass('is-invalid');
					$("#login_inputEmail + .invalid-feedback").html(data.error.message);
				} else if (data.error.field == 'password') {
					$("#login_inputPassword").addClass('is-invalid');
					$("#login_inputPassword + .invalid-feedback").html(data.error.message);
				}else{
					$("#loginFormError").html(data.error.message);
					$("#loginFormError").removeClass('d-none');
				}
				//grecaptcha.reset();
				//$("#signinModal_overlay").hide();
			}
		})
	}


	$('#register_form').validate({
		debug: true,
		errorClass: "is-invalid",
		validClass: "",
		rules: {
			firstname: {
				required: true
			},
			username: {
				required: true,
				checkemail: true
			},
			password: {
				minlength: 8,
				required: true,
				checkupper: true,
				checkdigit: true
			},
			agree_privacy: {
				required: true
			},
			agree_terms: {
				required: true
			}
		},
		messages: {
			firstname: {
				required: "Please enter first name."
			},
			username: {
				checkemail: "Please enter a valid email address."
			},
			password: {
				checkupper: "At least 1 Uppercase letter required.",
				checkdigit: "At least 1 number required."
			},
			agree_privacy: {
				required: "You need to agree to Privacy Policy."
			},
			agree_terms: {
				required: "You need to agree to Terms."
			}
		},
		onkeyup: function (el, e) {
			$("#" + el.id).valid();
		},
		onclick: function (el, e) {
			$("#" + el.id).valid();
		},
		errorPlacement: function (error, el) {
			if (el[0].type === "checkbox") {
				el.parent().addClass("has-warning");
				$("#checkbox_error").removeClass("d-none").html("<span>" + error.html() + "</span>");
			} else {
				el.removeClass('is-valid').addClass('is-invalid');
				el.next().html(error.html());
			}
		}
	});

	$('#register_form_appsumo').validate({
		debug: true,
		errorClass: "is-invalid",
		validClass: "",
		rules: {
			firstname: {
				required: true
			},
			username: {
				required: true,
				checkemail: true
			},
			password: {
				minlength: 8,
				required: true,
				checkupper: true,
				checkdigit: true
			},
			appsumo_code: {
				required: true
			},
			agree_privacy: {
				required: true
			},
			agree_terms: {
				required: true
			}
		},
		messages: {
			firstname: {
				required: "Please enter first name."
			},
			username: {
				checkemail: "Please enter a valid email address."
			},
			password: {
				checkupper: "At least 1 Uppercase letter required.",
				checkdigit: "At least 1 number required."
			},
			agree_privacy: {
				required: "You need to agree to Privacy Policy."
			},
			agree_terms: {
				required: "You need to agree to Terms."
			},
			appsumo_code: {
				required: "Appsumo code is required."
			}
		},
		onkeyup: function (el, e) {
			$("#" + el.id).valid();
		},
		onclick: function (el, e) {
			$("#" + el.id).valid();
		},
		errorPlacement: function (error, el) {
			if (el[0].type === "checkbox") {
				el.parent().addClass("has-warning");
				$("#checkbox_error").removeClass("d-none").html("<span>" + error.html() + "</span>");
			} else {
				el.removeClass('is-valid').addClass('is-invalid');
				el.next().html(error.html());
			}
		}
	});

	$('#signInForm').validate({
		debug: true,
		errorClass: "is-invalid",
		validClass: "",
		rules: {
			username: {
				required: true,
				checkemail: true
			},
			password: {
				minlength: 8,
				required: true,
				checkupper: true,
				checkdigit: true
			}
		},
		messages: {
			username: {
				checkemail: "Please enter a valid email address."
			},
			password: {
				checkupper: "At least 1 Uppercase letter required.",
				checkdigit: "At least 1 number required."
			}
		},
		onkeyup: function (el, e) {
			$("#" + el.id).valid();
		},
		errorPlacement: function (error, el) {
			el.removeClass('is-valid').addClass('is-invalid');
			el.next().html(error.html());
		}
	});

	$('#contactForm').validate({
		debug: false,
		errorClass: "is-invalid",
		validClass: "",
		rules: {
			name: {
				required: true,
			},
			email: {
				required: true,
				checkemail: true
			},
			phone: {
				required: false,
			},
			message: {
				minlength: 10,
			},
		},
		messages: {
			email: {
				checkemail: "Please enter a valid email address."
			},
		},
		onkeyup: function (el, e) {
			$("#" + el.id).validate();
		},
		onclick: function (el, e) {
			$("#" + el.id).validate();
		},
		errorPlacement: function (error, el) {
			el.removeClass('is-valid').addClass('is-invalid');
			el.next('span').addClass('invalid-feedback').html(error.html());
		},
	});

	$('#update_profile_form').validate({
		debug: false,
		errorClass: "is-invalid",
		validClass: "",
		rules: {
			profile_firstname: {
				required: true,
			},
			profile_lastname: {
				required: true,
			},
			country_code: {
				required: true,
			},
			interests: {
				required: true,
			},
			occupation: {
				required: true,
			},
		},
		errorPlacement: function (error, el) {
			if(el.hasClass('country-select')) {
				// el.removeClass('is-valid').addClass('is-invalid');
				el.next('span').next('span').addClass('invalid-feedback').html(error.html());
			}else{
				el.removeClass('is-valid').addClass('is-invalid');
				el.next('span').addClass('invalid-feedback').html(error.html());
			}

		},
	})

	$('#subscribe-to-newsletter').validate({
		debug: false,
		errorClass: "is-invalid",
		validClass: "",
		rules: {
			email: {
				required: true,
				checkemail: true
			},
		},
		messages: {
			email: {
				checkemail: "Please enter a valid email address."
			},
		},
		onkeyup: function (el, e) {
			//$("#" + el.id).valid();
		},
		errorPlacement: function (error, el) {
			el.removeClass('is-valid').addClass('is-invalid');
			el.next('p').html(error.html());
		}
	});

	if( getQueryVariable('new_mockup_saved') ) {
		window.MM.Utils.showToast('Mockup saved!<br><span>All your saved mockups are located under <a href="/dashboard/my-mockups" target="_blank">Your Library</a></span>', "success", 10000);
	}
});

function onCaptchaCompleted() {
	submitRegisterFormAjax();
}


function submitRegisterFormAjax() {
	$('#regLinkBtn')
		.prop('disabled', true)
		.html('Create account <span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>');
	$.ajax({
		url: '/register',
		method: 'POST',
		data: $("#register_form").serialize(),
		success: function (data) {
			$('#regLinkBtn')
				.prop('disabled', false)
				.html('Create account');
			if (data.error) {
				if (data.error.field == 'user') {
					$("#register_inputEmail").addClass('is-invalid');
					$("#register_inputEmail + .invalid-feedback").html(data.error.message);
				} else if (data.error.field == 'password') {
					$("#register_inputPassword").addClass('is-invalid');
					$("#register_inputPassword + .invalid-feedback").html(data.error.message);
				}
			}
			if (data.success) {
				window.dataLayer.push({
					'event': 'new_user',
					'user_id': data.user ? data.user.id : null
				});
				if(data.design_editor || data.mockup_editor) {
					updateHeader();
				}else{
					window.location = data.redirect;
				}
			}
			// grecaptcha.reset();
		},
		error: function (err) {
			$('#regLinkBtn')
				.prop('disabled', false)
				.html('Create account');
			console.error(err);
			//grecaptcha.reset();
			$("#signinModal_overlay").hide();
		}
	})
}

function submitRegisterFormAppsumoAjax() {
	$('#regLinkAppsumoBtn')
		.prop('disabled', true)
		.html('Create account <span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>');
	$.ajax({
		url: '/register',
		method: 'POST',
		data: $("#register_form_appsumo").serialize(),
		success: function (data) {
			$('#regLinkAppsumoBtn')
				.prop('disabled', false)
				.html('Create account');
			if (data.error) {
				if (data.error.field == 'user') {
					$("#register_inputEmail").addClass('is-invalid');
					$("#register_inputEmail + .invalid-feedback").html(data.error.message);
				} else if (data.error.field == 'password') {
					$("#register_inputPassword").addClass('is-invalid');
					$("#register_inputPassword + .invalid-feedback").html(data.error.message);
				} else if (data.error.field == 'appsumo_code') {
					$("#register_inputAppsumo").addClass('is-invalid');
					$("#register_inputAppsumo + .invalid-feedback").html(data.error.message);
				} else if (data.error.field == 'firstname') {
					$("#register_inputFirstname").addClass('is-invalid');
					$("#register_inputFirstname + .invalid-feedback").html(data.error.message);
				}
			}

			if (data.success) {
				if(data.design_editor || data.mockup_editor) {
					updateHeader();
				}else{
					window.location = data.redirect;
				}
			}
			// grecaptcha.reset();
		},
		error: function (err) {
			$('#regLinkAppsumoBtn')
				.prop('disabled', false)
				.html('Create account');
			console.error(err);
			//grecaptcha.reset();
			$("#signinModal_overlay").hide();
		}
	})
}

// Password recovery form

jQuery(function ($) {
	$('#accountRecoveryForm').on('submit', function (e) {
		e.preventDefault();
		var form = $(this);
		$.ajax({
			method: form.attr("method"),
			url: form.attr('action'),
			data: form.serialize(),
			success: function (data) {

				if (data.success) {
					$('#recovery-message').removeClass('alert-danger').addClass('alert-success').removeClass('d-none');
					$('#recovery-message > span').text(data.success);
				}
				if (data.error) {
					$('#recovery-message').removeClass('alert-sucess').addClass('alert-danger').removeClass('d-none');
					$('#recovery-message > span').text(data.error);
				}
			},
			error: function (error) {
				console.error(error);
			}
		})
	});
});

// Update password form

jQuery(function ($) {
	$('#updatePasswordForm').validate({
		debug: true,
		errorClass: "is-invalid",
		validClass: "",
		rules: {
			password: {
				minlength: 8,
				required: true,
				checkupper: true,
				checkdigit: true
			}
		},
		messages: {
			password: {
				checkupper: "At least 1 Uppercase letter required.",
				checkdigit: "At least 1 number required."
			}
		},
		onkeyup: function (el, e) {
			$("#" + el.id).valid();
		},
		errorPlacement: function (error, el) {
			el.removeClass('is-valid').addClass('is-invalid');
			el.next().html(error.html());
		}
	});

	$('#updatePasswordForm button').on('click', function(e) {
		$('#updatePasswordForm')[0].submit();
	});

});

// Update email form

jQuery(function ($) {
	$('#updateEmailForm').validate({
		debug: true,
		errorClass: "is-invalid",
		validClass: "",
		rules: {
			email: {
				required: true
			}
		},
		messages: {
			email: {
				required: "This field cannot be empty"
			}
		},
		onkeyup: function (el, e) {
			$("#" + el.id).valid();
		},
		errorPlacement: function (error, el) {
			el.removeClass('is-valid').addClass('is-invalid');
			el.next().html(error.html());
		}
	});

	$('#updateEmailForm button').on('click', function(e) {
		var form = $("#updateEmailForm");

		$.ajax({
			url: '/profile/update/email',
			method: 'post',
			data: form.serialize(),
			success: function(data) {
				if(data.success) {
					$("#updateEmailForm_email").addClass('is-valid');
					$("#updateEmailForm_email + .invalid-feedback").addClass('valid-feedback').removeClass('invalid-feedback');
					$("#updateEmailForm_email + .valid-feedback").html(data.message);
					window.location.href = "/profile";
				}else{
					$("#updateEmailForm_email").addClass('is-invalid');
					$("#updateEmailForm_email + .invalid-feedback").html(data.message);
				}
			},
			error: function(error) {
				console.log(error);
				$("#updateEmailForm_email").addClass('is-invalid');
				$("#updateEmailForm_email + .invalid-feedback").html(error.message);
			}
		})
	});

});

// Start for free CTA action

/*
<%
                            if(user) { %>
                                <a href="/<%= conf.routes.category %>/all" class="btn btn-outline-primary btn-block">Start for free</a>
                            <% }else{ %>
                                <button type="button" onclick="$('#ldLoginModal').modal();" class="btn btn-outline-primary btn-block">Start for free</button>
                            <% } %>
*/

jQuery(function ($) {
	$('.startForFree-CTA').on('click', function (e) {
		if (window.MM.user.email) {
			window.location.href = "/" + window.MM.routes.category + "/all";
		} else {
			$('#ldLoginModal').modal();
		}
	});
});

jQuery(function ($) {
	$('.cta-allCategory').on('click', function (e) {
		window.location.href = "/" + window.MM.routes.category + "/all";
	});
});

// Custom Modal actions

jQuery(function ($) {
	$('#ldLoginModal').on('hidden.bs.modal', function (e) {
		// do something...
		if($(this).hasClass('from-switch')) {
			$('#ldSignUpModal').modal('toggle');
			$('#ldLoginModal').removeClass('from-switch');
		}
	})
	$('#ldSignUpModal').on('hidden.bs.modal', function (e) {
		// do something...
		if($(this).hasClass('from-switch')) {
			$('#ldLoginModal').modal('toggle');
			$('#ldSignUpModal').removeClass('from-switch');
		}
	})

	$('.showLoginModal').on('click', function (e) {
		e.preventDefault();
		$('#ldSignUpModal').addClass('from-switch');
		$('#ldSignUpModal').modal('hide');

	});

	$('.showSignUpModal').on('click', function (e) {
		e.preventDefault();
		$('#ldLoginModal').addClass('from-switch');
		$('#ldLoginModal').modal('hide');
		if(window.gtag) {
			gtag('event', 'Registration modal opened', {
				event_category: 'Engagement',
				event_label: 'Direct'
			});
		}
	});

	$('.showResetPwdModal').on('click', function (e) {
		$('.modal').modal('hide');
		var target = $("#" + $(this).data('target'));
		target.find("#resetpwd_inputEmail").val($("#" + $(this).data('email')).val());
		target.modal();
	});

	$('.header-deal > button.close').on('click', function() {
		$('.header-deal').fadeOut();
	});

});

// Account delete
jQuery(function($) {
	$('.btn-delete-account').click(function(e) {
		return confirm('Are you sure you want to delete your account permanently?');
	});
});

// Dynamic editor script loader
jQuery(function($) {
	// loadEditorScriptDynamically();
	$('.btn-load-editor').click(function(e) {
		loadEditorScriptDynamically(true);
	});
});

// Livesearch
// Now in livesearch.js

// Countries, Select2

jQuery(function ($) {
	var allCountries = $.each([{
		n: "Afghanistan (‫افغانستان‬‎)",
		i: "af"
	}, {
		n: "Åland Islands (Åland)",
		i: "ax"
	}, {
		n: "Albania (Shqipëri)",
		i: "al"
	}, {
		n: "Algeria (‫الجزائر‬‎)",
		i: "dz"
	}, {
		n: "American Samoa",
		i: "as"
	}, {
		n: "Andorra",
		i: "ad"
	}, {
		n: "Angola",
		i: "ao"
	}, {
		n: "Anguilla",
		i: "ai"
	}, {
		n: "Antigua and Barbuda",
		i: "ag"
	}, {
		n: "Argentina",
		i: "ar"
	}, {
		n: "Armenia (Հայաստան)",
		i: "am"
	}, {
		n: "Aruba",
		i: "aw"
	}, {
		n: "Australia",
		i: "au"
	}, {
		n: "Austria (Österreich)",
		i: "at"
	}, {
		n: "Azerbaijan (Azərbaycan)",
		i: "az"
	}, {
		n: "Bahamas",
		i: "bs"
	}, {
		n: "Bahrain (‫البحرين‬‎)",
		i: "bh"
	}, {
		n: "Bangladesh (বাংলাদেশ)",
		i: "bd"
	}, {
		n: "Barbados",
		i: "bb"
	}, {
		n: "Belarus (Беларусь)",
		i: "by"
	}, {
		n: "Belgium (België)",
		i: "be"
	}, {
		n: "Belize",
		i: "bz"
	}, {
		n: "Benin (Bénin)",
		i: "bj"
	}, {
		n: "Bermuda",
		i: "bm"
	}, {
		n: "Bhutan (འབྲུག)",
		i: "bt"
	}, {
		n: "Bolivia",
		i: "bo"
	}, {
		n: "Bosnia and Herzegovina (Босна и Херцеговина)",
		i: "ba"
	}, {
		n: "Botswana",
		i: "bw"
	}, {
		n: "Brazil (Brasil)",
		i: "br"
	}, {
		n: "British Indian Ocean Territory",
		i: "io"
	}, {
		n: "British Virgin Islands",
		i: "vg"
	}, {
		n: "Brunei",
		i: "bn"
	}, {
		n: "Bulgaria (България)",
		i: "bg"
	}, {
		n: "Burkina Faso",
		i: "bf"
	}, {
		n: "Burundi (Uburundi)",
		i: "bi"
	}, {
		n: "Cambodia (កម្ពុជា)",
		i: "kh"
	}, {
		n: "Cameroon (Cameroun)",
		i: "cm"
	}, {
		n: "Canada",
		i: "ca"
	}, {
		n: "Cape Verde (Kabu Verdi)",
		i: "cv"
	}, {
		n: "Caribbean Netherlands",
		i: "bq"
	}, {
		n: "Cayman Islands",
		i: "ky"
	}, {
		n: "Central African Republic (République Centrafricaine)",
		i: "cf"
	}, {
		n: "Chad (Tchad)",
		i: "td"
	}, {
		n: "Chile",
		i: "cl"
	}, {
		n: "China (中国)",
		i: "cn"
	}, {
		n: "Christmas Island",
		i: "cx"
	}, {
		n: "Cocos (Keeling) Islands (Kepulauan Cocos (Keeling))",
		i: "cc"
	}, {
		n: "Colombia",
		i: "co"
	}, {
		n: "Comoros (‫جزر القمر‬‎)",
		i: "km"
	}, {
		n: "Congo (DRC) (Jamhuri ya Kidemokrasia ya Kongo)",
		i: "cd"
	}, {
		n: "Congo (Republic) (Congo-Brazzaville)",
		i: "cg"
	}, {
		n: "Cook Islands",
		i: "ck"
	}, {
		n: "Costa Rica",
		i: "cr"
	}, {
		n: "Côte d’Ivoire",
		i: "ci"
	}, {
		n: "Croatia (Hrvatska)",
		i: "hr"
	}, {
		n: "Cuba",
		i: "cu"
	}, {
		n: "Curaçao",
		i: "cw"
	}, {
		n: "Cyprus (Κύπρος)",
		i: "cy"
	}, {
		n: "Czech Republic (Česká republika)",
		i: "cz"
	}, {
		n: "Denmark (Danmark)",
		i: "dk"
	}, {
		n: "Djibouti",
		i: "dj"
	}, {
		n: "Dominica",
		i: "dm"
	}, {
		n: "Dominican Republic (República Dominicana)",
		i: "do"
	}, {
		n: "Ecuador",
		i: "ec"
	}, {
		n: "Egypt (‫مصر‬‎)",
		i: "eg"
	}, {
		n: "El Salvador",
		i: "sv"
	}, {
		n: "Equatorial Guinea (Guinea Ecuatorial)",
		i: "gq"
	}, {
		n: "Eritrea",
		i: "er"
	}, {
		n: "Estonia (Eesti)",
		i: "ee"
	}, {
		n: "Ethiopia",
		i: "et"
	}, {
		n: "Falkland Islands (Islas Malvinas)",
		i: "fk"
	}, {
		n: "Faroe Islands (Føroyar)",
		i: "fo"
	}, {
		n: "Fiji",
		i: "fj"
	}, {
		n: "Finland (Suomi)",
		i: "fi"
	}, {
		n: "France",
		i: "fr"
	}, {
		n: "French Guiana (Guyane française)",
		i: "gf"
	}, {
		n: "French Polynesia (Polynésie française)",
		i: "pf"
	}, {
		n: "Gabon",
		i: "ga"
	}, {
		n: "Gambia",
		i: "gm"
	}, {
		n: "Georgia (საქართველო)",
		i: "ge"
	}, {
		n: "Germany (Deutschland)",
		i: "de"
	}, {
		n: "Ghana (Gaana)",
		i: "gh"
	}, {
		n: "Gibraltar",
		i: "gi"
	}, {
		n: "Greece (Ελλάδα)",
		i: "gr"
	}, {
		n: "Greenland (Kalaallit Nunaat)",
		i: "gl"
	}, {
		n: "Grenada",
		i: "gd"
	}, {
		n: "Guadeloupe",
		i: "gp"
	}, {
		n: "Guam",
		i: "gu"
	}, {
		n: "Guatemala",
		i: "gt"
	}, {
		n: "Guernsey",
		i: "gg"
	}, {
		n: "Guinea (Guinée)",
		i: "gn"
	}, {
		n: "Guinea-Bissau (Guiné Bissau)",
		i: "gw"
	}, {
		n: "Guyana",
		i: "gy"
	}, {
		n: "Haiti",
		i: "ht"
	}, {
		n: "Honduras",
		i: "hn"
	}, {
		n: "Hong Kong (香港)",
		i: "hk"
	}, {
		n: "Hungary (Magyarország)",
		i: "hu"
	}, {
		n: "Iceland (Ísland)",
		i: "is"
	}, {
		n: "India (भारत)",
		i: "in"
	}, {
		n: "Indonesia",
		i: "id"
	}, {
		n: "Iran (‫ایران‬‎)",
		i: "ir"
	}, {
		n: "Iraq (‫العراق‬‎)",
		i: "iq"
	}, {
		n: "Ireland",
		i: "ie"
	}, {
		n: "Isle of Man",
		i: "im"
	}, {
		n: "Israel (‫ישראל‬‎)",
		i: "il"
	}, {
		n: "Italy (Italia)",
		i: "it"
	}, {
		n: "Jamaica",
		i: "jm"
	}, {
		n: "Japan (日本)",
		i: "jp"
	}, {
		n: "Jersey",
		i: "je"
	}, {
		n: "Jordan (‫الأردن‬‎)",
		i: "jo"
	}, {
		n: "Kazakhstan (Казахстан)",
		i: "kz"
	}, {
		n: "Kenya",
		i: "ke"
	}, {
		n: "Kiribati",
		i: "ki"
	}, {
		n: "Kosovo (Kosovë)",
		i: "xk"
	}, {
		n: "Kuwait (‫الكويت‬‎)",
		i: "kw"
	}, {
		n: "Kyrgyzstan (Кыргызстан)",
		i: "kg"
	}, {
		n: "Laos (ລາວ)",
		i: "la"
	}, {
		n: "Latvia (Latvija)",
		i: "lv"
	}, {
		n: "Lebanon (‫لبنان‬‎)",
		i: "lb"
	}, {
		n: "Lesotho",
		i: "ls"
	}, {
		n: "Liberia",
		i: "lr"
	}, {
		n: "Libya (‫ليبيا‬‎)",
		i: "ly"
	}, {
		n: "Liechtenstein",
		i: "li"
	}, {
		n: "Lithuania (Lietuva)",
		i: "lt"
	}, {
		n: "Luxembourg",
		i: "lu"
	}, {
		n: "Macau (澳門)",
		i: "mo"
	}, {
		n: "Macedonia (FYROM) (Македонија)",
		i: "mk"
	}, {
		n: "Madagascar (Madagasikara)",
		i: "mg"
	}, {
		n: "Malawi",
		i: "mw"
	}, {
		n: "Malaysia",
		i: "my"
	}, {
		n: "Maldives",
		i: "mv"
	}, {
		n: "Mali",
		i: "ml"
	}, {
		n: "Malta",
		i: "mt"
	}, {
		n: "Marshall Islands",
		i: "mh"
	}, {
		n: "Martinique",
		i: "mq"
	}, {
		n: "Mauritania (‫موريتانيا‬‎)",
		i: "mr"
	}, {
		n: "Mauritius (Moris)",
		i: "mu"
	}, {
		n: "Mayotte",
		i: "yt"
	}, {
		n: "Mexico (México)",
		i: "mx"
	}, {
		n: "Micronesia",
		i: "fm"
	}, {
		n: "Moldova (Republica Moldova)",
		i: "md"
	}, {
		n: "Monaco",
		i: "mc"
	}, {
		n: "Mongolia (Монгол)",
		i: "mn"
	}, {
		n: "Montenegro (Crna Gora)",
		i: "me"
	}, {
		n: "Montserrat",
		i: "ms"
	}, {
		n: "Morocco (‫المغرب‬‎)",
		i: "ma"
	}, {
		n: "Mozambique (Moçambique)",
		i: "mz"
	}, {
		n: "Myanmar (Burma) (မြန်မာ)",
		i: "mm"
	}, {
		n: "Namibia (Namibië)",
		i: "na"
	}, {
		n: "Nauru",
		i: "nr"
	}, {
		n: "Nepal (नेपाल)",
		i: "np"
	}, {
		n: "Netherlands (Nederland)",
		i: "nl"
	}, {
		n: "New Caledonia (Nouvelle-Calédonie)",
		i: "nc"
	}, {
		n: "New Zealand",
		i: "nz"
	}, {
		n: "Nicaragua",
		i: "ni"
	}, {
		n: "Niger (Nijar)",
		i: "ne"
	}, {
		n: "Nigeria",
		i: "ng"
	}, {
		n: "Niue",
		i: "nu"
	}, {
		n: "Norfolk Island",
		i: "nf"
	}, {
		n: "North Korea (조선 민주주의 인민 공화국)",
		i: "kp"
	}, {
		n: "Northern Mariana Islands",
		i: "mp"
	}, {
		n: "Norway (Norge)",
		i: "no"
	}, {
		n: "Oman (‫عُمان‬‎)",
		i: "om"
	}, {
		n: "Pakistan (‫پاکستان‬‎)",
		i: "pk"
	}, {
		n: "Palau",
		i: "pw"
	}, {
		n: "Palestine (‫فلسطين‬‎)",
		i: "ps"
	}, {
		n: "Panama (Panamá)",
		i: "pa"
	}, {
		n: "Papua New Guinea",
		i: "pg"
	}, {
		n: "Paraguay",
		i: "py"
	}, {
		n: "Peru (Perú)",
		i: "pe"
	}, {
		n: "Philippines",
		i: "ph"
	}, {
		n: "Pitcairn Islands",
		i: "pn"
	}, {
		n: "Poland (Polska)",
		i: "pl"
	}, {
		n: "Portugal",
		i: "pt"
	}, {
		n: "Puerto Rico",
		i: "pr"
	}, {
		n: "Qatar (‫قطر‬‎)",
		i: "qa"
	}, {
		n: "Réunion (La Réunion)",
		i: "re"
	}, {
		n: "Romania (România)",
		i: "ro"
	}, {
		n: "Russia (Россия)",
		i: "ru"
	}, {
		n: "Rwanda",
		i: "rw"
	}, {
		n: "Saint Barthélemy (Saint-Barthélemy)",
		i: "bl"
	}, {
		n: "Saint Helena",
		i: "sh"
	}, {
		n: "Saint Kitts and Nevis",
		i: "kn"
	}, {
		n: "Saint Lucia",
		i: "lc"
	}, {
		n: "Saint Martin (Saint-Martin (partie française))",
		i: "mf"
	}, {
		n: "Saint Pierre and Miquelon (Saint-Pierre-et-Miquelon)",
		i: "pm"
	}, {
		n: "Saint Vincent and the Grenadines",
		i: "vc"
	}, {
		n: "Samoa",
		i: "ws"
	}, {
		n: "San Marino",
		i: "sm"
	}, {
		n: "São Tomé and Príncipe (São Tomé e Príncipe)",
		i: "st"
	}, {
		n: "Saudi Arabia (‫المملكة العربية السعودية‬‎)",
		i: "sa"
	}, {
		n: "Senegal (Sénégal)",
		i: "sn"
	}, {
		n: "Serbia (Србија)",
		i: "rs"
	}, {
		n: "Seychelles",
		i: "sc"
	}, {
		n: "Sierra Leone",
		i: "sl"
	}, {
		n: "Singapore",
		i: "sg"
	}, {
		n: "Sint Maarten",
		i: "sx"
	}, {
		n: "Slovakia (Slovensko)",
		i: "sk"
	}, {
		n: "Slovenia (Slovenija)",
		i: "si"
	}, {
		n: "Solomon Islands",
		i: "sb"
	}, {
		n: "Somalia (Soomaaliya)",
		i: "so"
	}, {
		n: "South Africa",
		i: "za"
	}, {
		n: "South Georgia & South Sandwich Islands",
		i: "gs"
	}, {
		n: "South Korea (대한민국)",
		i: "kr"
	}, {
		n: "South Sudan (‫جنوب السودان‬‎)",
		i: "ss"
	}, {
		n: "Spain (España)",
		i: "es"
	}, {
		n: "Sri Lanka (ශ්‍රී ලංකාව)",
		i: "lk"
	}, {
		n: "Sudan (‫السودان‬‎)",
		i: "sd"
	}, {
		n: "Suriname",
		i: "sr"
	}, {
		n: "Svalbard and Jan Mayen (Svalbard og Jan Mayen)",
		i: "sj"
	}, {
		n: "Swaziland",
		i: "sz"
	}, {
		n: "Sweden (Sverige)",
		i: "se"
	}, {
		n: "Switzerland (Schweiz)",
		i: "ch"
	}, {
		n: "Syria (‫سوريا‬‎)",
		i: "sy"
	}, {
		n: "Taiwan (台灣)",
		i: "tw"
	}, {
		n: "Tajikistan",
		i: "tj"
	}, {
		n: "Tanzania",
		i: "tz"
	}, {
		n: "Thailand (ไทย)",
		i: "th"
	}, {
		n: "Timor-Leste",
		i: "tl"
	}, {
		n: "Togo",
		i: "tg"
	}, {
		n: "Tokelau",
		i: "tk"
	}, {
		n: "Tonga",
		i: "to"
	}, {
		n: "Trinidad and Tobago",
		i: "tt"
	}, {
		n: "Tunisia (‫تونس‬‎)",
		i: "tn"
	}, {
		n: "Turkey (Türkiye)",
		i: "tr"
	}, {
		n: "Turkmenistan",
		i: "tm"
	}, {
		n: "Turks and Caicos Islands",
		i: "tc"
	}, {
		n: "Tuvalu",
		i: "tv"
	}, {
		n: "Uganda",
		i: "ug"
	}, {
		n: "Ukraine (Україна)",
		i: "ua"
	}, {
		n: "United Arab Emirates (‫الإمارات العربية المتحدة‬‎)",
		i: "ae"
	}, {
		n: "United Kingdom",
		i: "gb"
	}, {
		n: "United States",
		i: "us"
	}, {
		n: "U.S. Minor Outlying Islands",
		i: "um"
	}, {
		n: "U.S. Virgin Islands",
		i: "vi"
	}, {
		n: "Uruguay",
		i: "uy"
	}, {
		n: "Uzbekistan (Oʻzbekiston)",
		i: "uz"
	}, {
		n: "Vanuatu",
		i: "vu"
	}, {
		n: "Vatican City (Città del Vaticano)",
		i: "va"
	}, {
		n: "Venezuela",
		i: "ve"
	}, {
		n: "Vietnam (Việt Nam)",
		i: "vn"
	}, {
		n: "Wallis and Futuna",
		i: "wf"
	}, {
		n: "Western Sahara (‫الصحراء الغربية‬‎)",
		i: "eh"
	}, {
		n: "Yemen (‫اليمن‬‎)",
		i: "ye"
	}, {
		n: "Zambia",
		i: "zm"
	}, {
		n: "Zimbabwe",
		i: "zw"
	}], function (i, c) {
		c.name = c.n;
		c.iso2 = c.i;
		c.id = c.i;
		c.text = c.n;
		delete c.n;
		delete c.i;
	});

	$(document).ready(function () {
		if ($.prototype.select2) {
			$('.country-select').select2({
				//theme: 'bootstrap',
				containerCssClass: 'form-control',
				data: allCountries
			});
			$('.country-select').each(function(e) {
				$(this).val($(this).data('selected'));
				$(this).trigger('change');
			})
		}
	});
});

// UTILS

// Utils.Slugify

jQuery(function ($) {
	$(document).ready(function () {
		if (MM.Utils.slugify) {

			$('.mm-slugify').on('input', function (e) {
				$('input.' + $(this).data('trigger')).val(MM.Utils.slugify($(this).val()));
				$('span.' + $(this).data('trigger')).html(MM.Utils.slugify($(this).val()));
			});
			$('.mm-slugify').trigger('input');
		}
	});


});

// UTILS End



// CTA
jQuery(function ($) {
	$('.cta-signup-btn').on('click', function (e) {
		$('#ldSignUpModal').modal();
		if(window.gtag) {
			gtag('event', 'Registration modal opened', {
				event_category: 'Engagement',
				event_label: 'Direct'
			});
		}
	});
});

jQuery(function ($) {
	$('.btn-remove-favorite').on('click', function (e) {
		var mockup_id = $(this).data('id');
		$.ajax({
			method: "DELETE",
			url: "/mockup/favorite",
			data: {
				"mockup": mockup_id
			},
			success: function (data) {
				window.location.reload();
			}
		})
	});
});


// Mockup back button

jQuery(function ($) {
	$("#mockup-single_back_btn").on('click', function (e) {
		e.preventDefault();
		var url = null;
		if (MM.mockup && MM.mockup.category) { url = "/" + MM.routes.category + "/" + MM.mockup.category };
		if (history.length > 2) {
			window.history.back();
		} else if (url) {
			window.location.href = url;
		} else {
			window.location.href = "/";
		}
	});
});

// Other
jQuery(function ($) {
	$(document).ready(function () {
		$(".current-year").html(new Date().getFullYear());
	});
})

jQuery(function($) {
	$(document).ready(function () {
		window.MM.Utils.initFeatureTooltips = function() {
			var featureTooltips = {
				watermark: 'Download UNLIMITED high-quality watermarked images for preview purposes.',
				downloads: 'Unlimited image downloads for all mockups, graphic design templates and full access to all image effects.',
				commercial: 'The royalty free commercial license allows you to use the final images on your website, social media or blog. You can also sell the images to a client for a fee or print your design to a physical product for sale. No attribution for Mediamodifier is required.',
				day_ticket: 'The Day Ticket is valid for 24 hours and grants instant access to all mockup images, design templates and image effects.',
				cancel_any_time: 'If you cancel your plan before the next renewal or right after completing the order, you will still retain access to all paid features until the end of your subscription period.',
				open_in_design_editor: 'Send this image to our Online Design Maker where you can easily add more texts, images or graphics on top of your final mockup.',
				open_in_cropper_tool: 'Opens the image in our Online Cropper Tool where you can easily freeform crop your picture or choose from popular image sizes and ratios (+circle).',
				social_publish: 'Publish the final image directly to your personal or multiple business social media pages at once. Currently supports Facebook and Twitter accounts.',
				social_publish_2: 'Publish the final image directly to your personal or multiple business social media pages at once. Currently supports Facebook and Twitter accounts. Sign in to use this feature.',
				eyedropper: 'Using the color picker:<br><br>1) Click on the icon to activate eyedropper(The icon turns pink).<br>2) Now use the dropper to select a color from the scene and make a left-click to confirm.<br>3) Click on the icon to deactivate eyedropper (icon turns blue).'
			}

			$('.mm-tooltip-custom-content').each(function(idx) {
				var question = $(this).data('question');
				if(question && featureTooltips[question]) {
					$(this).attr('data-ld-toggle', 'tooltip');
					$(this).attr('data-original-title', featureTooltips[question]);
					$(this).attr('data-placement', 'right');
					$(this).attr('data-html', true);
					$(this).tooltip();
				}
			});
		}
	});
});

jQuery(function ($) {
	$(document).ready(function() {
		$('.mm-embed-iframe').each(function(idx, element) {
			element.onload = function() {
				element.style.height = element.contentWindow.document.body.scrollHeight + 'px';
			}
		})
	});
})

jQuery(function ($) {
	$(document).ready(function() {
		window.MM.Utils.initFeatureTooltips();
	});
});

jQuery(function ($) {
	$(document).ready(function () {
		let listener = 'click';
		if('ontouchend' in window) {
			listener = 'touchend';
		}
		document.querySelectorAll('.pricing-switch-label').forEach(function(label) {
			label.addEventListener(listener, function(e) {

				if(listener === 'touchend') {
					const pos = document.getElementById("pricing-selector-container").getBoundingClientRect().top - 85 + window.scrollY;
					window.scroll(0,pos);
				}
				document.querySelectorAll('.pricing-switch-label').forEach(function(_label) {
					_label.classList.remove('checked');
				});
				label.classList.add('checked');
			});
		});
		document.querySelectorAll('input[name="pricing-radio"]').forEach(function(radio) {
			radio.addEventListener('change', function(e) {
				var interval = e.target.value;
				var billedInterval = 'yearly';
				if(interval === 'one') {
					billedInterval = 'once';
				}else if(interval === 'month') {
					billedInterval = 'monthly';
				}else if(interval === 'year') {
					billedInterval = 'yearly';
				}

				$('.mm-subscription-plan-interval').html(interval);
				$('.mm-subscription-plan-price').each(function(i, obj) {
					var price = $(obj).data('month-price-month');

					var plan = $(obj).data('plan');
					var buyButton = $('button[data-plan="' + plan + '"]');
					$(buyButton).data('product-id', $(buyButton).data('plan-interval-' + interval));

					if(interval === 'year') {
						price = $(obj).data('month-price-year');
						// $('.mm-annual-pricing-deal-price').removeClass("d-none");
						// $('.mm-subscription-plan-price-container').addClass('text-strikethrough');
						$('.pro-pricing-label').html('Pro');

						$('.billed-interval-text').removeClass('d-none');
						
						$('.pro-pricing-text').html('Best for individuals');
						buyButton.html('Subscribe Now');
						$(buyButton).data('product-id', $(buyButton).data('plan-interval-' + interval));
						// $(buyButton).data('product-id', $(buyButton).data('plan-deal'));
					}else if(interval === 'month') {
						$('.mm-annual-pricing-deal-price').addClass("d-none");
						$('.mm-subscription-plan-price-container').removeClass('text-strikethrough');
						$('.billed-interval-text').removeClass('d-none');
						$('.pro-pricing-label').html('Pro');
						$('.pro-pricing-text').html('Best for individuals');
						buyButton.html('Subscribe Now');
						$(buyButton).data('product-id', $(buyButton).data('plan-interval-' + interval));
					}else if(interval === 'one') {
						Paddle.Product.Prices(MM.paddle.day_ticket, function(prices) {
							price = formatCurrency(prices.price.net);
							$('.mm-annual-pricing-deal-price').addClass("d-none");
							$('.mm-subscription-plan-price-container').removeClass('text-strikethrough');
							$('.billed-interval-text').addClass('d-none');
							$('.pro-pricing-label').html('One-time payment');
							$('.pro-pricing-text').html('Best for one-time projects');
							buyButton.html('Buy Now');

							$(buyButton).data('product-id', $(buyButton).data('plan-one-time'));
							$(buyButton).data('sub-type', 'day_ticket');
							$(obj).html( price );
						});
						
					}
					$(obj).html( price );

					var billedIntervalEl = $('.mm-subscription-plan-interval[data-plan="' + plan + '"]');
					$(billedIntervalEl).html(billedInterval);

					if(interval !== 'one') {
						$('.mm-additional-member-interval').text(interval);
						var additionalMemberPrice = $('.mm-additional-member-price').data('price-' + interval);
					}

					$('.mm-additional-member-price').text( additionalMemberPrice );
				});

				// document.querySelector('.pricing-card-starter').classList.remove('d-none');
				$('.pricing-card-team').removeClass('d-none').addClass('d-flex');
				$('.pricing-card-team-footer').addClass('d-block').removeClass('d-none');
				$('.pricing-feature-team').removeClass('d-none');

				if(interval === 'one') {
					// document.querySelector('.pricing-card-starter').classList.add('d-none');
					$('.pricing-card-team').addClass('d-none').removeClass('d-flex');
					$('.pricing-card-team-footer').addClass('d-none').removeClass('d-block');
					$('.pricing-feature-team').addClass('d-none');
				}
				
			})
		});

		// -----------------
		$('#mm-billing-interval-switch').on('change', function(e) {
			var isChecked = $(this).is(':checked');
			var interval = 'month';
			var billedInterval = 'monthly';
			if(isChecked) {
				interval = 'year';
				billedInterval = 'yearly';
			}
			$('.mm-subscription-plan-interval').html(interval);
			$('.mm-subscription-plan-price').each(function(i, obj) {
				var price = $(obj).data('month-price-month');

				var plan = $(obj).data('plan');
				var buyButton = $('button[data-plan="' + plan + '"]');
				$(buyButton).data('product-id', $(buyButton).data('plan-interval-' + interval));

				if(interval === 'year') {
					var price = $(obj).data('month-price-year');
					$('.mm-annual-pricing-deal-price').removeClass("d-none");
					$('.mm-subscription-plan-price-container').addClass('text-strikethrough');
					buyButton.html('Get Deal Now');
					$(buyButton).data('product-id', $(buyButton).data('plan-deal'));
				}else{
					$('.mm-annual-pricing-deal-price').addClass("d-none");
					$('.mm-subscription-plan-price-container').removeClass('text-strikethrough');
					buyButton.html('Subscribe Now');
					$(buyButton).data('product-id', $(buyButton).data('plan-interval-' + interval));
				}
				$(obj).html( price );

				// 546029
				

				var billedIntervalEl = $('.mm-subscription-plan-interval[data-plan="' + plan + '"]');
				$(billedIntervalEl).html(billedInterval);

				$('.mm-additional-member-interval').text(interval);
				var additionalMemberPrice = $('.mm-additional-member-price').data('price-' + interval);

				$('.mm-additional-member-price').text( additionalMemberPrice );
			});
		});
	});
});

// eBook banners
jQuery(function ($) {
	$(document).ready(function() {

		/* 
		// TODO
		window.showEbookModal = function() {
			$('#ldModalEbookFreeCopy1').modal({
				focus: true,
				show: true
			});
		}
		*/
		
		$('#ldModalEbookFreeCopy1-cancel').on('click', function(e) {
			$('#ldModalEbookFreeCopy1').modal('hide');
		});
	});
});

jQuery(function ($) {
	$(document).ready(function() {
		$('#mm-global-search-trigger').click(function(e) {
			e.preventDefault();
			$('.mm-global-search').toggleClass('open');
			$('#mm-global-search-input').focus();
		});
		$('#mm-global-search-mobile-trigger').click(function(e) {
			e.preventDefault();
			$('.mm-global-search').toggleClass('open');
			$('#mm-global-search-input').focus();
		});
	});
})
