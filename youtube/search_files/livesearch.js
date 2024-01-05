// Livesearch
jQuery(function ($) {
	$(document).ready(function () {
		var el = $('.searchform__control');
		if (el.next().hasClass('dropdown-menu-search')) {
			el.next().addClass('invisible');
		}

	});
	addLivesearchEvent();
});

function addLivesearchEvent() {
	$('.searchform__control').on('input', function (e) {
		var text = e.target.value.replace(/[|&;$%@"<>()+,\\]/g, "");
		if (text.length > 2) {
			doLiveSearch(text, $(this));
		}else{
			$("#searchResultsDropdownMenu > .dropdown-menu-search").html('<span class="dropdown-item disabled">Type more than 2 letters.</span>');
		}
	});
}

function doLiveSearch(text, _el) {
	var el = _el;
	var newForm = false;
	if(_el.hasClass("searchform-v2")) {
		newForm = true;
		el = $("#searchResultsDropdownMenu");
	} 
	console.log(el);
	if (_.get(window, 'MM.Search.liveTimeout', null)) {
		clearTimeout(window.MM.Search.liveTimeout);
	}
	_.set(window, 'MM.Search.liveTimeout', setTimeout(function () {
		// Do the ajax stuff
		var resultsDiv = $("#searchResultsDropdownMenu > .dropdown-menu-search");
		resultsDiv.html('<span class="dropdown-item disabled">Searching...</span>');

		var search_type = $('form.searchform #search_type').val();

		$.ajax({
			method: "POST",
			url: "/search/live",
			data: {
				query: text,
				type: search_type
			},
			success: function (data) {
				// https://templates.prelive.mediamodifier.com/5df10b445320870ae1cd4d5c/hello-xmas-sales-discount-instagram-post.jpg
				// https://assets.prelive.mediamodifier.com/mockups/5a69f476982ce984374152f9/white-iphone-in-hand-mockup-template.jpg
				if (data.mockups.length) {
					var final_html = "";
					for (var i = 0; i < data.mockups.length; i++) {
						var result = data.mockups[i];
						var img_url = "/gfx/largetile.png";
						var result_name = result.name;
						if(data.mockups[i].template_type == 'mockup') {
							img_url = MM.urls.assets + "/mockups/" + result._id + "/" + result.slug + "_thumb.jpg";
						}else if(data.mockups[i].template_type == 'design-template') {
							img_url = MM.urls.templates + "/" + result._id + "/" + result.slug + "_thumb.jpg";
							result_name = result.title;
						}

						// var img_url = result.custom ? '/gfx/largetile.png' : "/" + MM.routes.mockup_images + "/" + data.mockups[i].folder + data.mockups[i].thumbnail;
						var url = result.custom ? result.url : "/" + data.mockups[i].template_type + "/" + data.mockups[i].slug + "/" + data.mockups[i].nr;
						var template_type = result.custom ? 'Collection' : data.mockups[i].template_type.replace("-", " ");

						
						if(newForm) {
							var html = '<a href="' + url + '" class="dropdown-item">' +
											' <div class="dropdown-item-card">' +
												'<div class="dropdown-item-card-figure">' +
													'<img src="' + img_url + '" alt="">' +
												'</div>' +
												'<div class="dropdown-item-card-body">' +
													'<div class="dropdown-item-card-label">' + template_type + '</div>' +
													'<div class="dropdown-item-card-title">' + result_name + '</div>' +
												'</div>' +
											'</div>' +
										'</a>';
							// var html = '<a href="' + url + '" class="dropdown-item">' + result.name + '</a>';
							final_html += html;
						}else{
							var html = '<a href="' + url + '" class="dropdown-item">' +
							'<figure class="card-figure" style="background-image: url(' + img_url + ')">' +
							'<div>' +
							'<img src="' + img_url + '" class="card-img">' +
							'</div>' +
							'</figure>' +
							'<span class="card-title text-truncate">' +
								'<span class="text-uppercase text-muted small">' + template_type + '</span><br>' + 
							result.name + '</span>' +
							'<b class="text-primary text-uppercase text-right">View &rarr;</b>' +
							'</a>';
							final_html += html;
						}
						

						
					}
					console.log("html to: ", el.next());

					if(newForm) {

						if(data.mockups.length !== 0) {
							resultsDiv.html(final_html);
							$("#searchResultsDropdownMenu").addClass("d-block");
							// $(document).one('click', function() {
							// 	$('#searchResultsDropdownMenu').removeClass('d-block');
							// });
						}else{
							// $("#searchResultsDropdownMenu").removeClass("d-block");
						}

					}else{

						el.next().html(final_html);
						if (el.next().hasClass('dropdown-menu-search')) {
							if (data.mockups.length !== 0) {
								el.next().removeClass('invisible');
							} else {
								el.next().addClass('invisible');
							}
						}
						el.next().show();

					}
					
				}else{
					resultsDiv.html('<span class="dropdown-item disabled">No results found.</span>')
				}
			},
			error: function (err) {
				console.error('err', err);
			}
		})
	}, 300));
}