var mmSocial = {
    addServiceModal: null,
    getAuthorizedServices: null,
    stateChanged: false
};

mmSocial.receiveMessage = function(event) {
    if (event.origin !== "https://mm-social.bind.ee" && event.origin !== "https://publish.mediamodifier.com")
        return;

    console.log(event.data);

    if (event.data.status == 1) {
        mmSocial.addServiceModal.close();
        mmSocial.getAuthorizedServices();
    }

    if (event.data.status == 0) {
        mmSocial.addServiceModal.close();
        // TODO: Get error from API and if error is not "User denied", then show message to user
    }
};

jQuery(function ($) {
    //$('#ldSocialShareModal').modal();

    window.addEventListener("message", mmSocial.receiveMessage, false);

    // $('#ldSocialShareAddService').on('click', mmSocial.openModal);

    // mmSocial.openModal = function() {
    //     console.log('Test');
    //     mmSocial.addServiceModal = window.open('https://www.facebook.com/v3.3/dialog/oauth?client_id=758439721271269&redirect_uri=https%3A%2F%2Fmm-social.bind.ee%2Fapi%2Fservice%2Fcallback%2Ffacebook%3Fstate%3D5e15ea8f79f27a3db456f812&scope=email%2Cmanage_pages%2Cpublish_pages&response_type=code');
    // };
    
    

    $('#ldModalPublish a.mm-social-add-service').on('click', function(e) {
        var service = $(this).data('service');
        var time_param = '?t=' + new Date().getTime();
        $.ajax({
            method: 'GET',
            url: '/api/social/services/' + service + '/add' + time_param,
            success: function(response) {
                console.log(response);
                if(response.redirect) {
                    mmSocial.addServiceModal = window.open(response.redirect);
                }
            },
            error: function(error) {
                console.error(error);
            }
        })
    });

    $('#ldModalPublish').on('show.bs.modal', function(e) {
        // get authenticated services
        mmSocial.getAuthorizedServices();
    });

    mmSocial.getAuthorizedServices = function() {
        var time_param = '?t=' + new Date().getTime();
        $.ajax({
            method: 'GET',
            url: '/api/social/services' + time_param,
            success: function(response) {
                if(response.accounts) {
                    var accounts = response.accounts;
                    var accountsListHtml = '';
                    if(accounts.length > 0) {
                        for(var i = 0; i < accounts.length; i++) {
                            var serviceName = accounts[i].service.type;
                            var serviceId = accounts[i].service.id;
                            var accountName = accounts[i].name;
                            var accountId = accounts[i].id;
                            var accountProfileImage = accounts[i].profile_image_url;
                            var html = '<div class="dropdown-item dropdown-item--static" data-service-type="' + serviceName + '" data-service-id="' + serviceId + '" data-account-id="' + accountId + '">';
                                html += '<label class="input-checkbox"><input type="checkbox">';
                                html += '<span><img class="rounded-circle mr-2" src="' + accountProfileImage + '" alt="' + accountName + ' ' + serviceName + ' profile image" />' + accountName + ' (<span class="text-capitalize">' + serviceName + '</span>)</span></label>';
                                html += '<span class="mm-delete-service btn-link text-danger small" style="cursor: pointer;">Delete</span>';
                                html += '</div>';
                            
                                accountsListHtml += html;
                        }
                    }
                    $('.mm-social-modal-approved-services').html(accountsListHtml);
                }
            },
            error: function(error) {
                console.error(error);
            }
        });
    }

    $('body').on('click', '.mm-delete-service', function(e) {
        e.stopPropagation();
        e.preventDefault();
        var serviceId = $(this).parent().data('service-id');
        var accountId = $(this).parent().data('account-id');
        console.log("Delete service: ", serviceId);
        deleteService(serviceId, accountId);
    });

    $('.mm-social-modal-approved-services').on('change', 'input[type=checkbox]' , function(e) {
        canPublishPost();
    });
    $('#mmSocialPublish-message').on('input', function(e) {
        if(!mmSocial.stateChanged) {
            mmSocial.stateChanged = true;
        }
        canPublishPost();
    });
    $('#mmPublishPost').on('click', function(e) {
        $('#mmPublishPost').prop('disabled', true);
        publishPost();
    });
    function canPublishPost() {
        var accountIsChecked = $('.mm-social-modal-approved-services input[type=checkbox]:checked').length > 0 ? true : false;
        var messageIsEmpty = $('#mmSocialPublish-message').val().length === 0 ? true : false;

        if(accountIsChecked && !messageIsEmpty && mmSocial.stateChanged) {
            $('#mmPublishPost').prop('disabled', false);
            return true;
        }else{
            $('#mmPublishPost').prop('disabled', true);
            return false;
        }
    }

    function deleteService(serviceId, accountId) {
        var time_param = '?t=' + new Date().getTime();
        $.ajax({
            method: 'DELETE',
            url: '/api/social/service/' + serviceId + '/' + accountId + time_param,
            success: function(response) {
                console.log(response);
                mmSocial.getAuthorizedServices();
            },
            error: function (response) {
                console.error(response);
            }
        })
    }
    
    function publishFacebookPost() {

    }

    function publishTwitterPost() {

    }

    function publishPost() {
        function sendPublishRequest(serviceId, serviceType, postData) {
                    
            var alertID = new Date().getTime();
            var alertHtml =  '<div id="mm-alert-' + alertID + '" class="alert alert-info fade show text-center" role="alert">';
                alertHtml +=    '<button type="button" class="close d-none" data-dismiss="alert" aria-label="Close">';
                alertHtml +=        '<span aria-hidden="true">&times;</span>';
                alertHtml +=    '</button>';
                alertHtml +=    '<p>Publishing post to ' + serviceType + ' ...</p>';
                alertHtml += '</div>';
            $('.mm-social-messages').append(alertHtml);

            var time_param = '?t=' + new Date().getTime();
            $.ajax({
                method: 'POST',
                url: '/api/social/service/' + serviceId + '/post' + time_param,
                data: JSON.stringify(postData),
                dataType: 'json',
                contentType: 'application/json',
                success: function(response) {
                    if(response.status && response.status === 1) {
                        $('#mm-alert-' + alertID).removeClass('alert-info').addClass('alert-success');
                        $('#mm-alert-' + alertID + ' p').html('Post is successfully published. <a href="' + response.data.response.post_url + '" target="_blank">View Post on ' + serviceType + '</a>.');
                    }else{
                        $('#mm-alert-' + alertID).removeClass('alert-info').addClass('alert-danger');
                        $('#mm-alert-' + alertID + ' p').html('Post not published. Please try again.');
                    }
                    $('#mm-alert-' + alertID + ' button.close').removeClass('d-none');
                    mmSocial.stateChanged = false;
                    canPublishPost();
                    // show success message
                },
                error: function(error) {
                    console.error(error);
                    // show error message
                    $('#mm-alert-' + alertID).removeClass('alert-info').addClass('alert-danger');
                    $('#mm-alert-' + alertID + ' p').html('Post not published. Please try again.');
                    $('#mm-alert-' + alertID + ' button.close').removeClass('d-none');
                }
            });
        }

        if( canPublishPost() ) {
            
            // get active account/service
            var approvedCheckedServices = $('.mm-social-modal-approved-services input[type=checkbox]:checked');
            if(approvedCheckedServices.length > 0) {
                for (var i = 0; i < approvedCheckedServices.length; i++) {

                    var serviceItem = $(approvedCheckedServices[i]).parent().parent();
                    var serviceId = serviceItem.data('service-id');
                    var accountId = serviceItem.data('account-id').toString();
                    var serviceType = serviceItem.data('service-type');
                    console.log(serviceType, serviceId, accountId);

                    var postData = {
                        content: $('#mmSocialPublish-message').val(),
                        url: ''
                    };
                    if (serviceType === 'facebook') {
                        postData.account_id = accountId;
                    }
                    // postData.url, postData.image



                    var base64_image = $('#mmSocialPublish-image').attr('src');
                    if (base64_image !== "") {
                        // send $('#mmSocialPublish-image').attr('src') to server, get image url back, add url to postData.image
                        // POST /api/image/upload , data: imageData, extension
                        // $.ajax({
                        //     method: 'POST',
                        //     url: '/api/image/upload',
                        //     data: JSON.stringify({
                        //         imageData: base64_image,
                        //         extension: 'jpg'
                        //     }),
                        //     dataType: 'json',
                        //     contentType: 'application/json',
                        //     success: function (response) {
                        //         console.log(response);
                        //         postData.image = window.MM.urls.baseurl + '/images/tmp/' + response.id + '.' + response.ext;
                        //         sendPublishRequest(serviceId, serviceType, postData);
                        //     },
                        //     error: function (error) {
                        //         console.error(error);
                        //     }
                        // })
                        postData.image_data = base64_image;
                        sendPublishRequest(serviceId, serviceType, postData);

                    } else {
                        sendPublishRequest(serviceId, serviceType, postData);
                    }

                }
                
            }

        }
    }

});