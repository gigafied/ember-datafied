;(function (global) {

"use strict";

var DF = global.DF = Ember.Namespace.create({
    VERSION : '{{VERSION}}'
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
            reg,
            store;

        store = DF.Store.create();
        store.set('app', app);
        store.set('container', container);

        app.store = store;

        app.register('store:main', store, {instantiate : false});

        app.inject('controller', 'store', 'store:main');
        app.inject('view', 'store', 'store:main');
        app.inject('route', 'store', 'store:main');

        reg = container.registry.dict || container.registry;

        for (p in reg) {
            if (p.indexOf('model:') > -1) {
                store.registerModel(p.split(':', 2)[1]);
            }
        }
    }
});

})(this);
