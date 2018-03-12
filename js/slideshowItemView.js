define([
    'core/js/adapt'
], function(Adapt, BlockView) {

    var SlideshowItemView = Backbone.View.extend({

    	className:function() {
    		return 'slideshow-item';
    	},

    	initialize:function(options) {
            this.client = options.client;

            this.$el.html(this.client.$el);

            this.listenToOnce(Adapt, 'remove', this.remove);
    	},

        remove:function() {

            function removeChildren(parent) {
                var childViews = parent.state.get('_childViews');

                _.each(childViews, function(v) {
                    removeChildren(v);
                    v.remove();
                })
            }

            removeChildren(this.client);

            this.client.remove();

            Backbone.View.prototype.remove.call(this);
        },

        report:function(t, a, b) {
            var c = this.client.model.get('_component');

            if (c) console.log(t, c);
        },

        preTransition:function(fromSlide, toSlide) {
            if (this == fromSlide) {
                //this.report('concealing', fromSlide, toSlide);
                this.client.trigger('concealing');
            } else if (this == toSlide) {
                //this.report('revealing', fromSlide, toSlide);
                this.client.trigger('revealing');
            }
        },

        postTransition:function(fromSlide, toSlide) {
            if (this == fromSlide) {
                this.report('concealed', fromSlide, toSlide);
                this.client.trigger('concealed');
            } else if (this == toSlide) {
                this.report('revealed', fromSlide, toSlide);
                this.client.trigger('revealed');
            }
        }
    });

    return SlideshowItemView;
});