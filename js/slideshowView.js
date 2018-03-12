define([
    'core/js/adapt',
    './slideshowItemView',
    './controlsButtons',
    './controlsTouch',
    './popupView',
    'libraries/jquery.resize',
    './modifierCloseButton',
    './modifierControlsButtons'
], function(Adapt, SlideshowItemView, ControlsButtons, ControlsTouch, PopupView) {

    // This module handles setup of a slideshow instance, changing slides and responding to resize events

    var slideshowIndex = 0;

    var SlideshowView = Backbone.View.extend({

        className:function() {
            return this.model.get('_usePopup') ? 'slideshow popup ' : 'slideshow';
        },

        defaultState: {
            '_currentIndex': -1,
            '_isRendering': true
        },

        initialize:function(options) {

            if (!_.isArray(options.views)) options.views = [options.views];
            
            this.state = new Backbone.Model(_.extend({
                'slides':[],
                'views':options.views,
                'viewModels':new Backbone.Collection(_.pluck(options.views, 'model'))
            }, this.defaultState));

            this.model.set('_slideshowId', 'slideshow_' + slideshowIndex++);

            this.listenTo(Adapt, {
                'device:preResize': this.onDevicePreResize,
                'device:postResize': this.onDevicePostResize,
                'remove': this.remove
            });
            
            this.listenTo(this.state, {
                'change:_currentIndex': this.onIndexChange,
                'change:_overrideVisibility': this.onOverrideVisibility,
                'slideshow:closed': this.remove
            });

            this.listenToOnce(this.state, {
                'slideshow:opened': this.onSlideshowOpened
            });

            this.listenTo(this.state.get('viewModels'), 'change:_isReady', this.checkReadiness);

            if (this.model.has('_container')) {
                this.$el.appendTo(this.model.get('_container'));
            } else {
                this.$el.appendTo('body');
            }

            Adapt.trigger('slideshow:created', this);

            this.render();

            this.checkReadiness();
        },

        render: function() {
            var usePopup = this.model.get('_usePopup');
            var useButtons = this.model.get('_useButtons');
            var useTouch = this.model.get('_useTouch');
            var template = usePopup ? Handlebars.templates['slideshowPopup'] : Handlebars.templates['slideshow'];
            var data = this.model.toJSON();

            this.$el.html(template(data));
            
            this.$el.attr('id', this.model.get('_slideshowId'));

            this.$el.addClass('initialising');

            // ensure we don't manipulate nested slideshows
            this.$ = function(selector) {
                return this.$el.find(selector).not('#'+this.model.get('_slideshowId')+' .slideshow ' + selector);
            }.bind(this);

            this.$el.addClass(this.model.get('_classes'));

            this.$('.slideshow-inner').addClass('transition-'+(this.model.get('_transitionType') || 'none'));

            this.renderSlideshowItems();

            this._debouncedSlideshowItemResized = _.debounce(_.bind(this.onSlideshowItemResized, this), 200)
            this.$('.slideshow-item').on('resize', this._debouncedSlideshowItemResized);

            this.$('.slideshow-viewport').scroll(function() {
                if (this.$('.slideshow-viewport').scrollLeft() > 0) {
                    console.log('correcting scroll');
                    this.$('.slideshow-viewport').scrollLeft(0);
                }
            }.bind(this));

            if (useButtons) {
                this.controlsButtons = new ControlsButtons({el:this.$('.controls'), $:this.$, model:this.model, state:this.state});
            }

            if (useTouch && Modernizr.touch) {
                this.controlsTouch = new ControlsTouch({el:this.$el, $:this.$, model:this.model, state:this.state});
            }

            if (usePopup) {
                this.popupView = new PopupView({el:this.$el, $:this.$, model:this.model, state:this.state});
            }

            return this;
        },

        renderSlideshowItems:function() {
            var views = this.state.get('views'),
                $container = this.$('.slideshow-view-container');

            _.each(views, function(view) {
                var slide = new SlideshowItemView({client:view});
                this.state.get('slides').push(slide);
                $container.append(slide.$el);
            }, this);
        },

        remove:function() {
            this.$('.slideshow-item').off('resize', this._debouncedSlideshowItemResized);

            _.each(this.state.get('slides'), function(slide) {
                slide.remove();
            });

            Adapt.wait.queue(function() {
                if (this.popupView) this.popupView.remove();
                if (this.controlsButtons) this.controlsButtons.remove();
                if (this.controlsTouch) this.controlsTouch.remove();

                Backbone.View.prototype.remove.call(this);
            }.bind(this));

            Adapt.trigger('slideshow:destroyed', this);

            return this;
        },

        updateWidth: function() {
            var viewportWidth = this.$('.slideshow-viewport').width();
            var slideCount = this.state.get('views').length;
            var fullSlideWidth = viewportWidth * slideCount;

            this.$('.slideshow-item').width(viewportWidth);
            this.$('.slideshow-view-container').width(fullSlideWidth);
        },

        updateHeight:function() {
            var containerHeight = this.getMaxSlideHeight();

            this.$('.slideshow-view-container').height(containerHeight);
            //this.state.set('_lastResizeToHeight', containerHeight);
        },

        unsetHeight:function() {
            this.$('.slideshow-view-container').height('');
        },

        getMaxSlideHeight:function() {
            return _.max(this.$('.slideshow-item').map(function(i, el) {return $(el).height();}));
        },

        checkReadiness:function() {
            if (this.state.get('viewModels').every(function(m) {return m.get('_isReady');})) {
                console.log(this.model.get('_slideshowId'), 'is ready');
                // the content (components, blocks etc) is ready
                this.state.set('_isReady', true);
                // we can stop listening now
                this.stopListening(this.state.get('viewModels'), 'change:_isReady', this.checkReadiness);
                // add the ready state in two places to simplify CSS selection
                this.$el.addClass('ready');
                this.$('.slideshow-inner').addClass('ready');
                // slideshow is in the DOM with its views so set the width
                this.updateWidth();
                // because a width has been set trigger events so that views can adjust accordingly
                Adapt.trigger('device:changed', Adapt.device.screenSize);
                Adapt.trigger('device:resize', Adapt.device.screenWidth);
                // now setup the slideshow dimensions etc
                this.resize();
                // move to a given slide or the first slide if not specified
                this.state.set('_currentIndex', this.model.get('_startingIndex') || 0);
                this.$el.removeClass('initialising');
                // inform listeners that the slideshow is ready
                this.state.trigger('slideshow:ready');
            }
        },

        isHeightChanging:function() {
            var containerHeight = this.$('.slideshow-view-container').height();
            var $slides = this.$('.slideshow-item');
            var largest = 0;

            $slides.each(function(index, el) {if ($(el).height() > largest) largest = $(el).height();});

            if (largest > containerHeight) {
                if (this.state.get('_lastResizeToHeight') != largest) {
                    this.state.set('_lastResizeToHeight', largest);
                    return true; // grow
                } else {
                    return false;
                }
            }

            var smaller = $slides.filter(function(i, el) {return $(el).height() < containerHeight;});

            if (smaller.length == $slides.length) {
                if (this.state.get('_lastResizeToHeight') != largest) {
                    this.state.set('_lastResizeToHeight', largest);
                    return true; // shrink

                } else {
                    return false;
                }
            }

            return false;
        },

        resize:function() {
            Adapt.trigger('device:preResize');
            Adapt.trigger('device:resize', Adapt.device.screenWidth);
            Adapt.trigger('device:postResize');
        },

        onDevicePreResize:function() {
            console.log('onDevicePreResize', this.model.get('_slideshowId'));
            this.$('.slideshow-item').off('resize', this._debouncedSlideshowItemResized);
            this.state.set('_isRendering', true);

            // remove scrollbar so that it does not influence dimensions
            if (this.popupView) this.popupView.unsetPopupSize();

            // set the available width and unset height so that views determine new height
            this.updateWidth();
            this.unsetHeight();
        },

        onDevicePostResize:function() {
            console.log('onDevicePostResize', this.model.get('_slideshowId'));

            // mainly for MediaElement.js (due to it listening to window resize events rather than device:resize)
            $(window).triggerHandler('resize');

            this.updateHeight();

            // determine if a scrollbar is needed
            if (this.popupView) this.popupView.resizePopup();

            // a scrollbar may have been added so adjust width
            this.updateWidth();
            
            // re-trigger to allow views to accommodate scrollbar
            Adapt.trigger('device:resize', Adapt.device.screenWidth);
            
            // re-trigger for any dependents (see above)
            $(window).triggerHandler('resize');

            this.updateHeight();

            // ensure margins are correct (if using slide transition)
            this.refreshSlideVisibility();

            if (!this.popupView || this.state.get('_isOpened')) {
                this.state.set('_isRendering', false);
                this.$('.slideshow-item').on('resize', this._debouncedSlideshowItemResized);
            }

            this.trigger('slideshow:postResize', this);
        },

        onSlideshowOpened:function() {
            console.log('onSlideshowOpened', this.model.get('_slideshowId'));
            // application of a scrollbar (if required) is deferred by the popup opening animation
            this.resize();
        },

        onIndexChange:function(state, index) {
            var
                fromIndex = this.state.previousAttributes()._currentIndex,
                duration = this.model.get('_transitionDuration'),
                now = Date.now(),
                elapsedTimeSinceLastNav = now - this.state.get('_lastUserNavTime'),
                direct = this.state.get('_disableTransitions');

            if (!(index >= 0)) return;

            // check if the actual slide has changed
            if (this.state.get('_activeSlide') != this.state.get('slides')[index]) {
                
                this.state.set('_previousActiveSlide', this.state.get('_activeSlide'));
                this.state.set('_activeSlide', this.state.get('slides')[index]);
            }

            if (elapsedTimeSinceLastNav < duration || !(fromIndex >= 0) || duration <= 0) {
                direct = true;
            }

            this.doTransition(fromIndex, index, direct);
        },

        onSlideshowItemResized:function(e) {
            if (!this.state.get('_isRendering') && this.isHeightChanging()) {
                console.log('onSlideshowItemResized', this.model.get('_slideshowId'));
                this.resize();
            }
        },

        onOverrideVisibility:function() {
            var $slideElements = $(_.map(this.state.get('slides'), function(s){ return s.el }));
            var $activeSlideElement = this.state.get('_activeSlide').$el;

            if (this.state.get('_overrideVisibility')) {
                $slideElements.css('visibility', 'inherit');
            } else {
                $slideElements.not($activeSlideElement).css('visibility', 'hidden');
            }
        },

        refreshSlideVisibility:function() {
            var index = this.state.get('_currentIndex');

            if (!(index >= 0) || this.state.get('_isTransitioning')) return;

            this.doTransition(index, index, true);
        },

        doTransition:function(fromIndex, index, direct) {
            var type = this.model.get('_transitionType');

            this.$(".slideshow-view-container").velocity('stop');
            this.$('.slideshow-item').velocity('stop');

            this.state.set('_isTransitioning', true);

            if (type == 'slide' && fromIndex != -1 && Math.abs(fromIndex - index) > 1) {
                this.doFadeTransitionOverride(fromIndex, index, direct);
            } else if (type == 'slide') {
                this.doSlideTransition(fromIndex, index, direct);
            } else if (type == 'fade') {
                this.doFadeTransition(fromIndex, index, direct);
            } else {
                this.doFadeTransition(fromIndex, index, true);
            }
        },

        doFadeTransitionOverride:function(fromIndex, index, direct) {
            // switch from slide to fade
            this.$('.slideshow-inner').removeClass('transition-slide').addClass('transition-fade');
            // adjust inline styles accordingly
            this.$(".slideshow-view-container").css('margin-left', '');
            // transition
            this.doFadeTransition(fromIndex, index, direct, function() {
                // restore slide transition
                this.$('.slideshow-inner').removeClass('transition-fade').addClass('transition-slide');
                // ensure inline styles are correct
                this.refreshSlideVisibility();
            }.bind(this));
        },

        doSlideTransition:function(fromIndex, index, direct, complete) {
            var
                slides = this.state.get('slides'),
                fromSlide = slides[fromIndex],
                toSlide = slides[index],
                $slideElements = $(_.map(slides, function(s){ return s.el })),
                $container = this.$(".slideshow-view-container"),
                viewportWidth = this.$('.slideshow-viewport').width(),
                duration = this.model.get('_transitionDuration');

            this.notifyPreTransition(fromSlide, toSlide);

            if (direct) {
                $container.css({'margin-left':-index * viewportWidth});
                $slideElements.css({'opacity':1, 'visibility':'hidden'});
                toSlide.$el.css('visibility', 'inherit');
                this.state.set('_isTransitioning', false);
                if (complete) complete();
                this.notifyPostTransition(fromSlide, toSlide);
            } else {
                $container.velocity({'margin-left':-index * viewportWidth}, {'duration':duration, 'easing':'easeInOutCubic'});
                $slideElements.css({'opacity':1, 'visibility':'inherit'});
                fromSlide.$el.velocity({'opacity':0.2}, {'complete':_.bind(animationComplete, this), 'duration':duration, 'easing':'easeOutCirc'});
            }

            function animationComplete() {
                $slideElements.not(toSlide.$el).css('visibility', 'hidden');
                this.state.set('_isTransitioning', false);
                if (complete) complete();
                this.notifyPostTransition(fromSlide, toSlide);
            }
        },

        doFadeTransition:function(fromIndex, index, direct, complete) {
            var
                slides = this.state.get('slides'),
                fromSlide = slides[fromIndex],
                toSlide = slides[index],
                $slideElements = $(_.map(slides, function(s){ return s.el })),
                duration = this.model.get('_transitionDuration');

            this.notifyPreTransition(fromSlide, toSlide);

            if (direct) {
                $slideElements.css({'opacity':1, 'visibility':'hidden'});
                toSlide.$el.css('visibility', 'inherit');
                this.state.set('_isTransitioning', false);
                if (complete) complete();
                this.notifyPostTransition(fromSlide, toSlide);
            } else {
                $slideElements.css({'opacity':0, 'visibility':'inherit'});
                fromSlide.$el.css('opacity', 1);
                fromSlide.$el.velocity({'opacity':0}, {'complete':_.bind(animationComplete, this), 'duration':duration, 'easing':'easeOutCirc'});
                toSlide.$el.velocity({'opacity':1}, {'duration':duration, 'easing':'easeInCirc'});
            }

            function animationComplete() {
                $slideElements.not(toSlide.$el).css('visibility', 'hidden');
                this.state.set('_isTransitioning', false);
                if (complete) complete();
                this.notifyPostTransition(fromSlide, toSlide);
            }
        },

        notifyPreTransition:function(fromSlide, toSlide) {
            // ensure that only actual slide changes trigger events
            // refreshSlideVisibility will mean fromSlide === toSlide
            // adding/removing slides can result in apparent transitions due to slides moving indices but the activeSlide does not change
            if (fromSlide != toSlide && fromSlide == this.state.get('_previousActiveSlide') && toSlide == this.state.get('_activeSlide')) {
                if (fromSlide) fromSlide.preTransition(fromSlide, toSlide);
                toSlide.preTransition(fromSlide, toSlide);
                this.trigger('slideshow:preTransition', fromSlide, toSlide);
            }
        },

        notifyPostTransition:function(fromSlide, toSlide) {
            // ensure that only actual slide changes trigger events
            // refreshSlideVisibility will mean fromSlide === toSlide
            // adding/removing slides can result in apparent transitions due to slides moving indices but the activeSlide does not change
            if (fromSlide != toSlide && fromSlide == this.state.get('_previousActiveSlide') && toSlide == this.state.get('_activeSlide')) {
                if (fromSlide) fromSlide.postTransition(fromSlide, toSlide);
                toSlide.postTransition(fromSlide, toSlide);
                this.trigger('slideshow:postTransition', fromSlide, toSlide);
            }
        },

        goto:function(index, skipTransition) {
            var disableTransitions = this.state.get('_disableTransitions');

            if (skipTransition) {
                this.state.set('_disableTransitions', true);
                this.state.set('_currentIndex', index);
                this.state.set('_disableTransitions', disableTransitions);
            } else {
                this.state.set('_currentIndex', index);
            }
        },

        addSlide:function(view, at) {
            var currentIndex = this.state.get('_currentIndex'),
                slide = new SlideshowItemView({client:view});

            // stop any animation
            this.$(".slideshow-view-container, .slideshow-item").velocity('stop');
            // ensure a slide is properly in view
            this.refreshSlideVisibility();

            this.state.get('slides').splice(at, 0, slide);

            if (at >= this.state.get('views').length) {
                this.state.get('views').push(view);
                this.state.get('viewModels').add(view.model);
                this.$('.slideshow-item').last().after(slide.$el);
            } else {
                this.state.get('views').splice(at, 0, view);
                this.state.get('viewModels').add(view.model, {'at':at});
                this.$('.slideshow-item').eq(at).before(slide.$el);
            }

            if (at <= currentIndex) this.goto(currentIndex + 1, true);

            this.resize();
        },

        removeSlide:function(view) {
            var currentIndex = this.state.get('_currentIndex');
            var targetIndex = this.getIndexByModel(view.model);

            // stop any animation
            this.$(".slideshow-view-container, .slideshow-item").velocity('stop');
            // ensure a slide is properly in view
            this.refreshSlideVisibility();

            var slide = this.state.get('slides').splice(targetIndex, 1)[0];
            this.state.get('views').splice(targetIndex, 1);
            this.state.get('viewModels').remove(view.model);

            slide.remove();

            if (targetIndex == currentIndex) {
                // current slide deleted so transition immediately to neighbour
                this.goto(Math.min(this.getSlideCount() - 1), true);
            } else if (targetIndex < currentIndex) {
                this.goto(currentIndex - 1, true);
            }

            this.resize();
        },

        getSlideCount:function() {
            return this.state.get('slides').length;
        },

        getIndexByModel:function(model) {
            return this.state.get('viewModels').indexOf(model);
        },

        getCurrentView:function() {
            return this.state.get('views')[this.state.get('_currentIndex')];
        }
    });

    return SlideshowView;

});
