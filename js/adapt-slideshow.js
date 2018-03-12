define([
    'core/js/adapt',
    'core/js/views/blockView',
    'core/js/views/articleView',
    './slideshowView'
],function(Adapt, BlockView, ArticleView, SlideshowView) {

    // This module offers convenience functions for creating slideshows

    var defaults = {
        _classes:null,
        _transitionType:'slide',
        _transitionDuration:200,
        _touch:{
            _slideDeltaThreshold:0.33,
            _slideVelocityThreshold:0.5
        },
        _isStepLocked:false,
        _usePopup:true,
        _useButtons:true,
        _useTouch:true
    };

    function getModelForConfig(config) {
        var params = _.extend({}, defaults, config);

        return new Backbone.Model(params);
    }

    Adapt.slideshow = _.extend({}, {

        instances:[],

        initialize:function() {
            this.listenTo(Adapt, 'slideshow:destroyed', this.onSlideshowDestroyed);
        },

        create:function(config, views) {
            var slideshow = new SlideshowView({model:getModelForConfig(config), views:views});
            this.instances.push(slideshow);
            console.log(slideshow);
            return slideshow;
        },

        createAbcView:function (model) {
            var view;

            if (model.get('_type') == 'article') {
                view = new ArticleView({model:model});
            } else if (model.get('_type') == 'block') {
                view = new BlockView({model:model});
            } else if (model.get('_type') == 'component') {
                view = Adapt.componentStore[model.get("_component")];
                view  = view.view || view;
                view = new view({model:model});
                // so what?...!
            } else {
                throw "Slideshow::createAbcView: content id must be a block or a component";
            }

            return view;
        },

        getViews:function(contentIds) {
            var views = [];

            _.each(contentIds, function(id) {
                var model = Adapt.findById(id),
                    view;

                if (model) {
                    view = Adapt.slideshow.createAbcView(model);

                    if (view) {
                        views.push(view);
                    }
                }
            });

            return views;
        },

        getSlideshowById:function(id) {
            return _.find(this.instances, function(slideshow) {
                return slideshow.id == id;
            });
        },

        onSlideshowDestroyed:function(slideshow) {
            var index = _.indexOf(this.instances, slideshow);
            if (index != -1) this.instances.splice(index, 1);
        }
    }, Backbone.Events);

    Adapt.on('app:dataReady', function() {
        Adapt.slideshow.initialize();
    });
});
