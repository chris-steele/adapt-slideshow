define([
    'core/js/adapt'
], function(Adapt) {

	// This module moves the left/right buttons in the DOM and keeps them positioned properly

	var ModifierControlsButtons = Backbone.View.extend({
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
			// move the controls
			this.slideshow.$el.prepend(this.slideshow.$('.controls'));

			this.listenTo(this.slideshow, 'slideshow:postResize', this.positionButton);
		},

		onSlideshowDestroyed:function(slideshow) {
			if (this.slideshow == slideshow) {
				this.remove();
			}
		},

		positionButton:function() {
            var $left = this.slideshow.$('.left');
            var $right = this.slideshow.$('.right');
            var containerWidth = this.slideshow.$('.slideshow-popup').outerWidth();

            $left.css({
                'margin-left': -containerWidth/2 - $left.outerWidth(),
                'margin-top': -$left.outerHeight()/2
            });

            $right.css({
                'margin-left': containerWidth/2,
                'margin-top': -$right.outerHeight()/2
            });
        }
	});

	Adapt.on('slideshow:created', function(slideshow) {
		var modifier = new ModifierControlsButtons();
		modifier.manage(slideshow);
	});

	return ModifierControlsButtons;
});