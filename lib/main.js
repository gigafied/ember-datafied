;(function (global) {

"use strict";

var DF = global.DF = Ember.Namespace.create({
    VERSION : '0.1.2'
});

DF.required = function (message) {
    return function () {
        var className = this.constructor.toString();
        throw new Error(message.replace('{{className}}', className));
    };
};

include('./adapter');
include('./rest-adapter');

include('./collection');
include('./model');
include('./store');

include('./attr');
include('./belongsTo');
include('./hasMany');


Ember.Application.initializer({

    name : 'ember-datafied',

    initialize: function (container, app) {

        var p,
            store;

        store = DF.Store.create();
        store.set('app', app);
        store.set('container', container);

        app.store = store;

        app.register('store:main', store, {instantiate : false});

        app.inject('controller', 'store', 'store:main');
        app.inject('view', 'store', 'store:main');
        app.inject('route', 'store', 'store:main');

        for (p in container.registry.dict) {
            if (p.indexOf('model:') > -1) {
                store.registerModel(p.split(':', 2)[1]);
            }
        }
    }
});

})(this);
