define([
    'core/js/adapt'
], function(Adapt) {

    var PopupView = Backbone.View.extend({

        // This module serves as the view/controller for when the slideshow is behaving as a popup

        disableAnimation: false,
        escapeKeyAttached: false,

        initialize: function(options) {
            this.state = options.state;
            this.$ = options.$;
            this.disableAnimation = Adapt.config.has('_disableAnimation') ? Adapt.config.get('_disableAnimation') : false;
            this.setupEventListeners();
            this.$el.toggleClass('fullscreen', this.isFullscreen());
            this.$el.addClass('initialising');
            this.$('.slideshow-shadow').addClass('shadow-visible');
            //this.initialHeight = this.$('.slideshow-popup').height();
            this.resizePopup();
        },

        remove:function() {
            //$('body').scrollEnable();

            this.$('.slideshow-popup').velocity('stop');

            Adapt.trigger('popup:closed');

            Backbone.View.prototype.remove.call(this);

            return this;
        },

        setupEventListeners: function() {
            this.listenTo(this.state, 'slideshow:ready', this.onReady);
            this.listenTo(this.state, 'slideshow:postResize', this.resizePopup);

            this._onKeyUp = _.bind(this.onKeyUp, this);
            this.setupEscapeKey();

            _.bindAll(this, 'onCloseButtonClicked');

            // setup manually because this.$ is scoped to this slideshow (and not nested slideshows)
            this.$('.slideshow-popup-done').click(this.onCloseButtonClicked);
            this.$('.slideshow-shadow').click(this.onCloseButtonClicked);
        },

        setupEscapeKey: function() {
            var hasAccessibility = Adapt.config.has('_accessibility') && Adapt.config.get('_accessibility')._isActive;

            if (!hasAccessibility && ! this.escapeKeyAttached) {
                $(window).on('keyup', this._onKeyUp);
                this.escapeKeyAttached = true;
            } else {
                $(window).off('keyup', this._onKeyUp);
                this.escapeKeyAttached = false;
            }
        },

        isFullscreen:function() {
            return !this.model.has('_container');
        },

        onKeyUp: function(event) {
            if (event.which != 27) return;
            event.preventDefault();

            this.closePopup();
        },

        onCloseButtonClicked: function(event) {
            event.preventDefault();
            //tab index preservation, popup must close before subsequent callback is triggered
            this.closePopup();
        },

        onReady:function() {
            console.log('popup ready');
            this.showPopup();
        },

        unsetPopupSize:function() {
            this.$('.slideshow-popup').removeAttr('style');
        },

        resizePopup: function() {
            this.unsetPopupSize();

            var isFullscreen = this.isFullscreen();
            var constrainingHeight = isFullscreen ? $(window).height() : this.$('.slideshow-popup').outerHeight();
            var constrainingWidth = isFullscreen ? $(window).width() : this.$('.slideshow-popup').outerWidth();
            var containerHeight = this.$('.slideshow-popup').outerHeight();
            var containerWidth = this.$('.slideshow-popup').outerWidth();
            var contentHeight = this.$('.slideshow-popup-inner').outerHeight();

            /*if (this.$el.hasClass('initialising') && this.model.has('_startHeight')) {
                containerHeight = constrainingHeight = this.model.get('_startHeight');
                this.$('.slideshow-popup')[0].style.setProperty('height', containerHeight+'px', 'important');
            }*/

            if (this.$el.hasClass('initialising') || this.$el.hasClass('finalising')) {
                // content is not ready and/or hidden
                if (isFullscreen) {
                    contentHeight = Math.min(containerHeight, constrainingHeight);
                } else {
                    contentHeight = containerHeight;
                }
            }

            if (isFullscreen) {
                if (contentHeight > constrainingHeight) {
                    this.$('.slideshow-popup').css({
                        'height': '100%',
                        'top': '0px',
                        'overflow-y': 'scroll',
                        '-webkit-overflow-scrolling': 'touch'
                    });
                } else {
                    this.$('.slideshow-popup').css({
                        'margin-top': -(containerHeight/2)
                    });
                }
            } else {
                if (contentHeight > constrainingHeight) {
                    this.$('.slideshow-popup').css({
                        'overflow-y': 'scroll',
                        '-webkit-overflow-scrolling': 'touch'
                    });
                }
                this.$('.slideshow-popup').css({
                    'margin-top': -(containerHeight/2)
                });
            }

            this.$('.slideshow-popup').css({
                'margin-left': -(containerWidth/2)
            });
        },

        showPopup: function() {
            this.state.trigger('slideshow:opening', this);

            // remove the initialising class to allow the height to be animated
            this.$el.addClass('opening');

            // calculate the height to grow to
            var endHeight = this.$('.slideshow-popup').height();

            // set the height explicitly
            this.$('.slideshow-popup').css('height', /*this.model.get('_startHeight') || */this.$('.slideshow-ghost').height());

            /*if (this.model.has('_startHeight')) {
                this.$('.slideshow-popup').css('margin-top', -this.model.get('_startHeight')/2);
            }*/
            
            // grow to accommodate the content
            this.$('.slideshow-popup').velocity({
                'height': endHeight,
                'margin-top': -endHeight/2
            }, {
                duration:400,
                easing:'easeOutCubic',
                complete:function(){
                    this.$('.slideshow-popup-inner').css('opacity', 1);
                    this.$el.removeClass('opening');
                    // add scrollbar (if applicable)
                    this.resizePopup();
                    this.state.set('_isOpened', true);
                    this.state.trigger('slideshow:opened', this);
                    Adapt.trigger('popup:opened', this.$('.slideshow-popup'));
                    //$('body').scrollDisable();

                    //set focus to first accessible element
                    this.$('.slideshow-popup').a11y_focus();
                }.bind(this)
            });
        },

        closePopup: function (event) {
            if (this.state.get('_isClosing')) return;

            this.state.set('_isClosing', true);

            this.state.trigger('slideshow:closing', this);

            this.$el.addClass('finalising');
            this.$('.slideshow-popup-inner').css('opacity', 0);
            // remove scrollbar (if applicable)
            this.resizePopup();

            this.$('.slideshow-popup').velocity('stop');

            var targetHeight = this.$('.slideshow-ghost').height();

            if (this.state.get('_isOpened')) {
                // shrink to cue card
                this.$('.slideshow-popup').velocity({
                    'height': targetHeight,
                    'margin-top': -targetHeight/2
                }, {
                    duration:400,
                    easing:'easeOutCubic',
                    complete:function(){
                        this.state.trigger('slideshow:closed', this);
                    }.bind(this)
                });
            } else {
                this.state.trigger('slideshow:closed', this);
            }
        }

    });

    return PopupView;

});
