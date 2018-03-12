define([
    'core/js/adapt'
], function(Adapt) {

	// This module moves the close button in the DOM and keeps it positioned properly

	var ModifierCloseButton = Backbone.View.extend({
		manage:function(slideshow) {

			this.slideshow = slideshow;

			this.listenTo(Adapt, 'slideshow:destroyed', this.onSlideshowDestroyed);

			if (this.slideshow.state.get('_isOpened')) {
				this.onOpened();
                this.positionButton();
            } else {
				this.listenTo(this.slideshow.state, 'slideshow:opened', function() {
	                this.onOpened();
	                this.positionButton();
	            });
			}
		},

		onOpened:function() {
			// move the button
			this.slideshow.$el.prepend(this.slideshow.$('.slideshow-popup-done'));

			this.listenTo(this.slideshow, 'slideshow:postResize', this.positionButton);
		},

		onSlideshowDestroyed:function(slideshow) {
			if (this.slideshow == slideshow) {
				this.remove();
			}
		},

		positionButton:function() {
            var $btn = this.slideshow.$('.slideshow-popup-done');
            var containerWidth = this.slideshow.$('.slideshow-popup').outerWidth();
            var containerHeight = this.slideshow.$('.slideshow-popup').outerHeight();
            $btn.css({
                'margin-left': containerWidth/2 - $btn.outerWidth(),
                'margin-top': -containerHeight/2 -$btn.outerHeight()
            });
        }
	});

	Adapt.on('slideshow:created', function(slideshow) {
		var modifier = new ModifierCloseButton();
		modifier.manage(slideshow);
	});

	return ModifierCloseButton;
});