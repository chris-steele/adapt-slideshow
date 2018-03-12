define([
    'core/js/adapt'
], function(Adapt) {

    var ControlsButtons = Backbone.View.extend({

        // This module serves as the view/controller for slideshow navigation (left/right buttons)

        initialize:function(options) {
            this.state = options.state;
            this.$ = options.$;

            this.listenTo(this.state, {
                'change:_currentIndex': this.update,
                'change:_isRendering': this.onRendering
            });
            this.listenTo(this.state.get('viewModels'), 'add remove', this.update);
            this.listenTo(this.state.get('viewModels'), 'change:_isComplete', this.update);

            this.setupListeners();
            this.setupControls();
        },

        setupListeners:function() {
            _.bindAll(this, 'onLeftClicked', 'onRightClicked');

            // setup manually because this.$ is scoped to this slideshow (and not nested slideshows)
            this.$('.left').click(this.onLeftClicked);
            this.$('.right').click(this.onRightClicked);
        },

        update:function() {
            if (this.state.get('_currentIndex') < 0) return;

            var
                views = this.state.get('views'),
                currentIndex = this.state.get('_currentIndex'),
                currentView = views[currentIndex],
                currentModel = currentView.model,
                totalViews = views.length,
                isStepLocked = this.model.get('_isStepLocked');

            this.setupControls();

            if (totalViews <= 1) {
                this.setButtonsEnabled(false, false);
            } else if (currentIndex === 0) {
                this.setButtonsEnabled(false, !isStepLocked || currentModel.get('_isComplete'));
            } else if (currentIndex == totalViews - 1) {
                this.setButtonsEnabled(true, false);
            } else {
                this.setButtonsEnabled(true, !isStepLocked || currentModel.get('_isComplete'));
            }
        },

        setButtonsEnabled:function(isLeftEnabled, isRightEnabled) {
            var $left = this.$('.left');
            var $right = this.$('.right');

            $left.a11y_cntrl_enabled(isLeftEnabled);
            $right.a11y_cntrl_enabled(isRightEnabled);
        },

        setupControls:function(active) {
            var active = this.state.get('views').length > 1;

            this.$el.toggleClass('controls-inactive', !active);
        },

        onLeftClicked:function(e) {
            e.preventDefault();

            var currentIndex = this.state.get('_currentIndex');
            if (currentIndex > 0) this.state.set('_currentIndex', currentIndex - 1);

            this.state.set('_lastUserNavTime', Date.now());
        },

        onRightClicked:function(e) {
            e.preventDefault();

            var currentIndex = this.state.get('_currentIndex');
            if (currentIndex < this.state.get('views').length - 1) this.state.set('_currentIndex', currentIndex + 1);

            this.state.set('_lastUserNavTime', Date.now());
        },

        onRendering:function() {
            this.state.get('_isRendering') ? this.setButtonsEnabled(false, false) : this.update();
        }
    });

    return ControlsButtons;
});