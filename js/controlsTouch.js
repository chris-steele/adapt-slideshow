define([
    'core/js/adapt',
    'libraries/hammer'
], function(Adapt, Hammer) {

    var ControlsTouch = Backbone.View.extend({

        // This module handles touch gestures for a slideshow instance on supported devices

        // There are two class properties which are used to crudely but efficiently target gestures to the appropriate slideshow:
        // ControlsTouch.__activeSlideshowId and ControlsTouch.__activeSlideshowIdDefunct
        // Although atypical in usage this allows slideshows to be nested

        scrollThreshold:10,

        initialize:function(options) {
            this.state = options.state;
            this.$ = options.$;

            this.listenTo(this.state, 'change:_isRendering', this.onRendering);

            this.hammer = new Hammer.Manager(this.$('.slideshow-view-container').get(0));
            this.hammer.add(new Hammer.Pan({
                threshold: this.scrollThreshold,
                direction: Hammer.DIRECTION_HORIZONTAL
            }));

            _.bindAll(this, 'onPanStart', 'onPanMove', 'onPanEnd', 'onTouchStart', 'onTouchEnd', 'onScroll');

            this.addTouchListeners();
        },

        remove:function() {
            this.removeTouchListeners();
            this.hammer.destroy();

            Backbone.View.prototype.remove.call(this);

            return this;
        },

        addTouchListeners:function() {
            this.removeTouchListeners();

            this.hammer.on('panstart', this.onPanStart);
            this.hammer.on('panmove', this.onPanMove);
            this.hammer.on('panend', this.onPanEnd);

            this.$('.slideshow-popup').on('touchstart', this.onTouchStart);
            this.$('.slideshow-popup').on('touchend', this.onTouchEnd);
        },

        removeTouchListeners:function() {
            this.hammer.off('panstart', this.onPanStart);
            this.hammer.off('panmove', this.onPanMove);
            this.hammer.off('panend', this.onPanEnd);

            this.$('.slideshow-popup').off('touchstart', this.onTouchStart);
            this.$('.slideshow-popup').off('touchend', this.onTouchEnd);
        },

        setIndex:function(index) {
            this.state.set('_currentIndex', index);

            this.state.set('_lastUserNavTime', Date.now());
        },

        onPanStart:function(e) {
            if (ControlsTouch.__activeSlideshowId != this.model.get('_slideshowId')) return;

            console.log(this.model.get('_slideshowId'), 'onPanStart');

            this.$(".slideshow-view-container").velocity('stop');
            this.$('.slideshow-item').velocity('stop').css('opacity', 1);

            this.state.unset('_overrideVisibility');

            this.state.set('_overrideVisibility', true);
        },

        onPanMove:function(e) {
            if (ControlsTouch.__activeSlideshowId != this.model.get('_slideshowId')) return;

            console.log(this.model.get('_slideshowId'), 'onPanMove');

            if (this.isPanningVertically) {
                e.stopPropagation();
                e.preventDefault();
                return;
            }

            this.isPanningHorizontally = true;

            var $container = this.$(".slideshow-view-container");
            var index = this.state.get('_currentIndex');
            var viewportWidth = this.$('.slideshow-viewport').width();
            var pos = -index * viewportWidth + e.deltaX;

            $container.css('margin-left', Math.min(0, Math.max(pos, -(this.state.get('views').length - 1) * viewportWidth)));
        },

        onPanEnd:function(e) {
            if (ControlsTouch.__activeSlideshowId != this.model.get('_slideshowId')) return;

            console.log(this.model.get('_slideshowId'), 'onPanEnd');

            var $container = this.$(".slideshow-view-container");
            var viewportWidth = this.$('.slideshow-viewport').width();
            var index = this.state.get('_currentIndex');
            var deltaN = e.deltaX/viewportWidth;

            if (deltaN <= -this.model.get('_touch')._slideDeltaThreshold) {
                this.setIndex(Math.min(this.state.get('views').length - 1, this.state.get('_currentIndex') + 1));
            }
            else if (deltaN >= this.model.get('_touch')._slideDeltaThreshold) {
                this.setIndex(Math.max(0, this.state.get('_currentIndex') - 1));
            }
            else if (e.overallVelocityX <= -this.model.get('_touch')._slideVelocityThreshold) {
                this.setIndex(Math.min(this.state.get('views').length - 1, this.state.get('_currentIndex') + 1));
            }
            else if (e.overallVelocityX >= this.model.get('_touch')._slideVelocityThreshold) {
                this.setIndex(Math.max(0, this.state.get('_currentIndex') - 1));
            }
            else {
                $container.velocity({'margin-left':-index * viewportWidth}, {'easing':'easeOutCirc', 'complete':_.bind(function() {
                    this.state.unset('_overrideVisibility');
                }, this)});
            }

            this.endTouch();
        },

        onRendering:function() {
            this.state.get('_isRendering') ? this.removeTouchListeners() : this.addTouchListeners();
        },

        endTouch:function() {
            this.scrollStartPos = this.isPanningHorizontally = this.isPanningVertically = false;

            this.$('.slideshow-popup').off('scroll', this.onScroll);
        },

        onTouchStart:function(e) {
            if (!ControlsTouch.__activeSlideshowIdDefunct && ControlsTouch.__activeSlideshowId && ControlsTouch.__activeSlideshowId != this.model.get('_slideshowId')) return;

            console.log(this.model.get('_slideshowId'), 'onTouchStart');

            ControlsTouch.__activeSlideshowId = this.model.get('_slideshowId');
            ControlsTouch.__activeSlideshowIdDefunct = false;

            this.scrollStartPos = this.$('.slideshow-popup').scrollTop();

            this.$('.slideshow-popup').off('scroll', this.onScroll);
            this.$('.slideshow-popup').on('scroll', this.onScroll);
        },

        onTouchEnd:function(e) {
            if (ControlsTouch.__activeSlideshowId && ControlsTouch.__activeSlideshowId != this.model.get('_slideshowId')) return;

            console.log(this.model.get('_slideshowId'), 'onTouchEnd');

            if (e.touches && e.touches.length > 0) return;

            console.log(this.model.get('_slideshowId'), 'onTouchEnd set ControlsTouch.__activeSlideshowIdDefunct = true');

            ControlsTouch.__activeSlideshowIdDefunct = true;

            this.endTouch();
        },

        onScroll:function(e) {
            if (this.isPanningHorizontally) {
                return e.preventDefault();
            }

            var scrollPos = this.$('.slideshow-popup').scrollTop();

            if (_.isNumber(this.scrollStartPos) && Math.abs(this.scrollStartPos - scrollPos) >= this.scrollThreshold) {
                this.isPanningVertically = true;
            }
        }
    });

    return ControlsTouch;
});