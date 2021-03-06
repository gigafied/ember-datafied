/*!
 * ember-datafied
 *
 * @author      gigafied (Taka Kojima)
 * @repo        https://github.com/gigafied/ember-datafied
 * @license     Licensed under MIT license
 * @VERSION     0.4.7
 */
;(function (global) {

"use strict";

var DF = global.DF = Ember.Namespace.create({
    VERSION : '0.4.7'
});

DF.required = function (message) {
    return function () {
        var className = this.constructor.toString();
        throw new Error(message.replace('{{className}}', className));
    };
};

DF.Adapter = Ember.Object.extend({

    find : function (model, q) {
        return this.store.find(model, q);
    },

    all : function (model) {
        return this.store.all(model);
    },

    saveRecord : function (model) {

        if (model.get('isNew')) {
            return this.createRecord(model);
        }

        return this.updateRecord(model);
    },

    fetch : DF.required('{{className}} must implement the `fetch()` method'),
    fetchAll : DF.required('{{className}} must implement the `fetchAll()` method'),
    createRecord : DF.required('{{className}} must implement the `createRecord()` method'),
    updateRecord : DF.required('{{className}} must implement the `updateRecord()` method'),
    deleteRecord : DF.required('{{className}} must implement the `deleteRecord()` method')
});

DF.RESTAdapter = DF.Adapter.extend({

    host : '',
    prefix : '',

    ajaxOptions : function (url, method) {

        return {
            url : url,
            type : method,
            contentType : "application/json",
            dataType : "json"
        };
    },

    ajax : function (url, data, method, options) {

        options = options || this.ajaxOptions(url, method);

        data = data || {};

        return new Ember.RSVP.Promise(function (resolve, reject) {

            if (method === "GET") {
                options.data = data;
            }

            else {
                options.data = JSON.stringify(data);
            }

            options.success = function (json) {
                Ember.run(null, resolve, json);
            };

            options.error = function(jqXHR, textStatus, errorThrown) {
                if (jqXHR) {
                    jqXHR.then = null;
                }

                Ember.run(null, reject, jqXHR);
            };


            Ember.$.ajax(options);
        });
    },

    httpGet : function (url, data) {
        return this.ajax(url, data, 'GET');
    },

    httpPost : function (url, data) {
        return this.ajax(url, data, 'POST');
    },

    httpPut : function (url, data) {
        return this.ajax(url, data, 'PUT');
    },

    httpDelete : function (url, data) {
        return this.ajax(url, data, 'DELETE');
    },

    getURL : function (factory, id) {

        var url;

        url = [this.get('host'), this.get('prefix')];

        url.push(factory.url || factory.typeKey);

        if (id) {
            url.push(id);
        }

        return url.join('/').replace(/([^:]\/)\/+/g, "$1");
    },

    fetch : function (factory, id) {
        return this.httpGet(
            this.getURL(factory, id)
        );
    },

    fetchAll : function (factory) {
        return this.httpGet(
            this.getURL(factory)
        );
    },

    createRecord : function (record) {
        return this.httpPost(
            this.getURL(record.constructor),
            record.serialize()
        );
    },

    updateRecord : function (record) {
        return this.httpPut(
            this.getURL(record.constructor, record.get('pk')),
            record.serialize()
        );
    },

    deleteRecord : function (record) {
        return this.httpDelete(
            this.getURL(record.constructor, record.get('pk'))
        );
    }
});

DF.Collection = Ember.ArrayController.extend({

    factory : null,
    primaryKey : null,

    typeKey : null,
    collectionKey : null,

    isDirty : function () {

        var isDirty = false;

        this.forEach(function (item, index) {
            if (item.get('isDirty')) {
                isDirty = true;
            }
        });

        return isDirty;

    }.property('content.@each.isDirty'),

    findByPrimaryKey : function (q) {
        return this.findBy(this.primaryKey, q);
    },

    removeByPrimaryKey : function (q) {
        return this.remove(this.findBy(this.primaryKey, q));
    },

    remove : function (obj) {
        return this.removeObject(obj);
    },

    toString : function () {
        return ('collection:' + this.collectionKey);
    },

    serialize : function (isEmbedded) {

        var a = [];

        this.forEach(function (item, index, collection) {

            if (isEmbedded) {
                a.push(item.serialize());
            }

            else {
                a.push(item.get('pk'));
            }

        }, this);

        return a;
    }

});

DF.Model = Ember.Object.extend({

    primaryKey : 'id',

    url : null,
    adapter : DF.RESTAdapter.create(),

    typeKey : null,
    collectionKey : null,

    __data : null,
    __dirtyAttributes : null,

    __currentPromise : null,

    __isSaving : false,
    __isFetching : false,
    __isLoaded : false,
    __isDeleting : false,
    __isDeleted : false,

    init : function () {

        var i,
            meta,
            attributes;

        attributes = this.getAttributes();

        for (i = 0; i < attributes.length; i ++) {

            meta = this.constructor.metaForProperty(attributes[i]);

            if (meta.options && typeof meta.options.defaultValue !== 'undefined') {
                this.set(meta.key, meta.options.defaultValue);
            }

        }

        this.set('dirtyAttributes', []);

        return this._super.apply(this, arguments);
    },

    didDefineProperty : function (proto, key, val) {

        var meta,
            protoConstructor;

        protoConstructor = proto.constructor;

        if (val instanceof Ember.Descriptor) {

            meta = val.meta();
            meta.key = key;

            if (meta.isAttribute) {

                if (!protoConstructor.__attributes) {
                    protoConstructor.__attributes = [];
                }

                protoConstructor.__attributes.push(key);

            }

            else if (meta.isRelationship) {

                if (!protoConstructor.__relationships) {
                    protoConstructor.__relationships = [];
                }

                protoConstructor.__relationships.push(key);
            }
        }
    },

    pk : function (key, val) {

        if (!this.primaryKey) {
            return null;
        }

        if (val !== undefined) {
            this.set(this.primaryKey, val);
        }

        return this.get(this.primaryKey);

    }.property(),

    getAttributes : function () {
        return this.constructor.getAttributes();
    },

    getRelationships : function () {
        return this.constructor.getRelationships();
    },

    dirtyAttributes : function (key, val) {

        if (arguments.length === 2) {
            val = val || [];
            this.__dirtyAttributes = val;
        }

        else {
            val = this.__dirtyAttributes;
        }

        return val || [];

    }.property(),

    hasDirtyAttributes : function () {
        var da = this.get('dirtyAttributes');
        return da && !!da.length;
    }.property('dirtyAttributes'),

    isClean : function () {
        return !this.get('isDirty');
    }.property('isDirty'),

    isValid : function () {
        return this.validate();
    }.property(),

    isNew : function () {
        return this.primaryKey ? !this.get('pk') : false;
    }.property('pk'),

    isLoaded : function () {
        return this.get('isNew') || this.get('__isLoaded');
    }.property('__isLoaded'),

    isLoading : function () {
        return !this.get('__isLoaded');
    }.property('__isLoaded'),

    isDeleted : function () {
        return this.get('__isDeleted');
    }.property('__isDeleted'),

    serialize : function (isNested) {

        var a,
            p,
            pk,
            key,
            meta,
            json,
            nestedJson,
            attributes,
            properties,
            relationships;

        pk = this.get('pk');
        json = {};
        attributes = this.getAttributes();
        relationships = this.getRelationships();

        properties = this.getProperties(attributes.concat(relationships));

        for (p in properties) {

            meta = this.constructor.metaForProperty(p);
            key = meta.options.key || p;

            a = key.split('.');

            while (a.length) {
                json[a[0]] = json[a[0]] || {};
                a.splice(0, 1);
            }

            Ember.set(json, key, meta.serialize.call(this));
        }

        if (this.primaryKey) {
            json[this.primaryKey] = pk;
        }

        if (isNested) {
            nestedJson = json;
            json = {};
            json[this.typeKey] = nestedJson;
        }

        return json;
    },

    deserialize : function (json, skipDirty) {

        var i,
            p,
            pk,
            key,
            val,
            meta,
            dirty,
            orig,
            attributes,
            properties,
            relationships;

        dirty = this.get('dirtyAttributes').concat();

        attributes = this.getAttributes();
        relationships = this.getRelationships();

        properties = this.getProperties(attributes.concat(relationships));

        pk = this.get('pk');

        for (p in properties) {

            meta = this.constructor.metaForProperty(p);

            if (skipDirty && ~dirty.indexOf(p)) {
                continue;
            }

            key = meta && meta.options ? meta.options.key || p : p;

            val = Ember.get(json, key);

            if (typeof val !== 'undefined') {
                val = val === null ? null : meta.deserialize.call(this, val, skipDirty);
                this.set(meta.key, val);
            }

        }

        if (this.primaryKey) {
            this.set('pk', json[this.primaryKey] || pk);
        }

        this.set('__isLoaded', true);

        if (skipDirty) {

            orig = {};

            for (i = 0; i < dirty.length; i ++) {
                p = dirty[i];
                orig[dirty[i]] = this.__originalData[p];
            }
        }

        else {
            dirty = [];
            orig = null;
        }

        this.__originalData = orig;
        this.set('dirtyAttributes', dirty);
    },

    validate : function () {
        return true;
    },

    merge : function (data, skipDirty) {

        var p,
            dirty;

        data = data || {};
        data = data instanceof DF.Model ? data.deserialize() : data;
        delete data[this.primaryKey];

        dirty = this.get('dirtyAttributes').concat();

        for (p in data) {
            if (!skipDirty || dirty.indexOf(p) < 0) {
                this.set(p, data[p]);
            }
        }
    },

    save : function () {
        return this.saveRecord();
    },

    fetch : function () {
        return this.fetchRecord();
    },

    fetchRecord : function () {

        this.set('__isLoaded', false);

        if (this.get('__isFetching')) {
            return this.__currentPromise;
        }

        this.set('__isFetching', true);

        return this.__currentPromise = this.adapter.fetch(this.constructor, this.get('pk')).then(function (json) {

            this.set('__isFetching', false);

            json = Ember.isArray(json) ? json[0] : json;
            json = json[this.typeKey] || json;

            this.deserialize(json);

        }.bind(this));
    },

    saveRecord : function () {

        if (this.get('isValid')) {

            this.set('dirtyAttributes', []);

            return this.adapter.saveRecord(this).then(function (json) {

                var isNew = this.get('isNew');

                json = Ember.isArray(json) ? json[0] : json;
                json = json[this.typeKey] || json;

                this.deserialize(json);
                this.set('__isLoaded', true);

                if (isNew) {
                    this.store.add(this);
                }

                this.set('__isSaving', false);

            }.bind(this));
        }

        else {
            return new Ember.RSVP.Promise(function (resolve, reject) {
                reject(new Error('Tried to save an invalid record.'));
            });
        }
    },

    deleteRecord : function () {

        this.set('__isDeleting', true);
        this.store.remove(this);

        return this.adapter.deleteRecord(this).then(function (json) {

            this.set('__isDeleting', false);
            this.set('__isDeleted', true);

            this.destroy();

        }.bind(this));
    },

    clone : function () {

        var copy;

        copy = this.constructor.create(this.serialize());
        copy.set('pk', null);

        copy.set('__isLoaded', true);
        copy.set('dirtyAttributes', []);

        return copy;
    },

    revert : function (revertRelationships) {

        var i,
            p,
            r,
            meta,
            relationships;

        this.merge(this.__originalData);

        relationships = this.getRelationships();

        for (i = 0; i < relationships.length; i ++) {
            p = relationships[i];
            meta = this.constructor.metaForProperty(p);

            if (meta.options && meta.options.embedded || revertRelationships) {

                r = this.get(p);

                if (meta.type === 'hasMany') {
                    meta.revert.call(this);
                }

                else {
                    r && r.revert(revertRelationships);
                }
            }
        }

        this.__originalData = null;

        this.set('dirtyAttributes', []);
    }
});

DF.Model.reopenClass({

    getAttributes : function () {

        var a,
            b,
            i;

        this.proto();
        a = this.__attributes || [];

        if (typeof this.superclass.getAttributes === 'function') {

            b = this.superclass.getAttributes();

            for (i = 0; i < b.length; i ++) {
                if (a.indexOf(b[i]) < 0) {
                    a.push(b[i]);
                }
            }
        }

        return a;
    },

    getRelationships : function () {

        var a,
            b,
            i;

        this.proto();
        a = this.__relationships || [];

        if (typeof this.superclass.getRelationships === 'function') {

            b = this.superclass.getRelationships();

            for (i = 0; i < b.length; i ++) {
                if (a.indexOf(b[i]) < 0) {
                    a.push(b[i]);
                }
            }
        }

        return a;
    },

    extend : function () {

        var i,
            r,
            d,
            p,
            meta,
            props,
            computed,
            dirtyChecks,
            classProps,
            relationships;

        d = {};
        r = this._super.apply(this, arguments);
        classProps = ['primaryKey', 'url', 'typeKey', 'collectionKey'];

        props = [].slice.apply(arguments, [-1])[0];

        for (i = 0; i < classProps.length; i ++) {

            p = props[classProps[i]];

            if (p) {
                d[classProps[i]] = p;
            }
        }

        r.reopenClass(d);

        relationships = r.getRelationships();
        dirtyChecks = ['hasDirtyAttributes'];

        for (i = 0; i < relationships.length; i ++) {
            p = relationships[i];
            meta = r.metaForProperty(p);

            if (meta.isRelationship && meta.options.embedded) {

                dirtyChecks.push(p + '.isDirty');

                if (meta.type === 'hasMany') {
                    dirtyChecks.push(p + '.@each.isDirty');
                }
            }
        }

        Ember.defineProperty(r.prototype, 'isDirty', Ember.computed.apply(null, dirtyChecks.concat(function () {

            var i,
                r,
                r3;

            for (i = 0; i < dirtyChecks.length; i ++) {

                r = this.get(dirtyChecks[i]);

                if (r) {

                    if (r.forEach) {

                        r.forEach(function (r2) {
                            if (r2 === true) {
                                r = true;
                            }
                        });
                    }

                    if (r === true) {
                        return true;
                    }

                }
            }

            return false;

        })).readOnly());

        return r;
    }
});

DF.Store = Ember.Object.extend({

    init : function () {

        this.clear();

        return this._super.apply(this, arguments);
    },

    clear : function () {
        this.__cache = {};
        this.__registry = {};
        this.__store = {};
    },

    getTypeKey : function (key) {
        key = key.split('.');
        key = key[key.length - 1];
        key = key.charAt(0).toLowerCase() + key.slice(1);
        return key;
    },

    addToCache : function (model, records) {

        var i,
            pk,
            cache,
            record,
            factory;

        factory = this.modelFor(model);
        cache = this.__cache[factory.collectionKey] = this.__cache[factory.collectionKey] || {};

        for (i = 0; i < records.length; i ++) {

            record = records[i];
            pk = record.get('pk');

            if (pk !== null && typeof pk !== 'undefined') {
                cache[pk] = record;
            }
        }

        return cache;
    },

    removeFromCache : function (model, records) {

        var i,
            pk,
            cache,
            record,
            factory;

        factory = this.modelFor(model);
        cache = this.__cache[factory.collectionKey] = this.__cache[factory.collectionKey] || {};

        for (i = 0; i < records.length; i ++) {

            record = records[i];
            pk = record.get('pk');

            cache[pk] = null;
        }

        return cache;
    },

    findInCache : function (model, id) {

        var cache,
            factory;

        factory = this.modelFor(model);
        cache = this.__cache[factory.collectionKey] = this.__cache[factory.collectionKey] || {};
        return cache[id];
    },

    findInCacheOrCreate : function (model, id, data) {

        var record,
            factory;

        factory = this.modelFor(model);

        if (id) {
            record = this.findInCache(model, id);
            if (data && record) {
                record.deserialize(data);
            }
        }

        if (!record) {
            record = factory.create();
            data && record.deserialize(data);
            record.set('pk', id);
            this.add(factory, record);
        }

        return record;
    },

    getCollection : function (model) {

        var factory,
            collection;

        factory = this.modelFor(model);

        if (!factory) {
            throw new Ember.Error('No model was found for "' + model + '"');
        }

        collection = this.__store[factory.collectionKey];

        if (!collection) {
            collection = this.__store[factory.collectionKey] = this.createCollection(model);
        }

        return collection;
    },

    createCollection : function (model) {

        var factory,
            collection;

        factory = this.modelFor(model);

        if (!factory) {
            throw new Ember.Error('No model was found for "' + model + '"');
        }

        collection = DF.Collection.create({content : Ember.A()});

        collection.set('factory', factory);
        collection.set('primaryKey', factory.primaryKey);
        collection.set('typeKey', factory.typeKey);
        collection.set('collectionKey', factory.collectionKey);

        return collection;
    },

    modelFor : function (key) {

        var factory,
            typeKey,
            normalizedKey;

        factory = typeof key !== 'string' ? key : null;

        if (!factory) {
            factory = this.__registry[key];
        }

        if (!factory) {

            normalizedKey = this.container.normalize('model:' + key);
            typeKey = this.getTypeKey(key);

            factory = this.container.lookupFactory(normalizedKey);

            if (factory) {
                factory.typeKey = factory.typeKey || typeKey;
                factory.collectionKey = factory.collectionKey || factory.typeKey + 's';
            }
        }

        if (factory) {
            factory.store = factory.prototype.store = this;
        }

        return factory;
    },

    registerModel : function (key) {

        var factory = this.modelFor(key);

        this.__registry[factory.typeKey] = factory;
        this.__registry[factory.collectionKey] = factory;

        return factory;
    },

    find : function (model, q) {

        var collection;

        collection = this.getCollection(model);

        if (typeof q === 'number' || typeof q === 'string') {
            return this.findInCache(model, q);
        }

        return collection.find(function (item, index, collection) {

            var p,
                doesMatch;

            doesMatch = true;

            for (p in q) {
                if (item.get(p) !== q[p]) {
                    doesMatch = false;
                }
            }

            return doesMatch;

        }, this);
    },

    filter : function (model, q, props) {

        var i,
            p,
            props,
            collection;

        collection = this.getCollection(model);
        props = props ? props.concat() : [];

        if (typeof q === 'object') {
            for (p in q) {
                props.push('content.@each.' + p);
            }
        }
        else if (typeof q === 'function') {
            props.push('content.length');
        }

        return DF.Collection.extend({

            model : Ember.A(),

            init : function () {

                this.arrayDidChange = this.arrayDidChange.bind(this);

                for (i = 0; i < props.length; i ++) {
                    collection.addObserver(props[i], this.arrayDidChange);
                }

                this.arrayDidChange();

                return this._super.apply(this, arguments);
            },

            arrayDidChange : function () {

                var model;

                model = collection.get('model').filter(function (item, index) {

                    var doesMatch = true;

                    if (!q) {
                        return doesMatch;
                    }

                    if (typeof q === 'object') {
                        for (p in q) {
                            if (item.get(p) !== q[p]) {
                                doesMatch = false;
                            }
                        }
                    }
                    else if (typeof q === 'function') {
                        doesMatch = q.apply(this, [item]);
                    }

                    return doesMatch;

                });

                this.set('model', model);

            },

            destroy : function () {
                for (i = 0; i < props.length; i ++) {
                    collection.removeObserver(props[i], this.arrayDidChange);
                }

                return this._super.apply(this, arguments);
            }

        }).create();
    },

    all : function (model) {
        return this.getCollection(model);
    },

    fetchUnloadedRecords : function () {

        var p,
            i,
            r;

        for (p in this.__cache) {
            for (i in this.__cache[p]) {
                r = this.__cache[p][i];
                if (r && !r.get('isLoaded')) {
                    r.fetchRecord();
                }
            }
        };
    },

    fetch : function (model, q) {

        var record,
            factory;

        factory = this.modelFor(model);

        return factory.prototype.adapter.fetch(factory, q).then(function (json) {

            json = json[factory.typeKey] || json;
            json = Ember.isArray(json) ? json[0] : json;

            record = this.findInCacheOrCreate(model, json[factory.primaryKey], json);

            return record;

        }.bind(this));
    },

    fetchAll : function (model) {

        var i,
            item,
            record,
            records,
            factory,
            collection;

        records = [];
        factory = this.modelFor(model);

        return factory.prototype.adapter.fetchAll(factory).then(function (json) {

            json = json[factory.collectionKey] || json;
            json = Ember.isArray(json) ? json : [json];

            for (i = 0; i < json.length; i ++) {
                item = json[i];
                record = this.findInCacheOrCreate(model, item[factory.primaryKey], item);
                records.push(record);
            }

            return this.all(model);

        }.bind(this));
    },

    add : function (model, records) {

        var i,
            pk,
            record;

        if (model instanceof DF.Model || model instanceof DF.Collection) {
            records = model;
            model = model.factory || model.constructor;
        }

        records = Ember.isArray(records) ? records : [records];

        for (i = 0; i < records.length; i ++) {
            record = records[i];
            if (record.get('pk')) {
                if (this.findInCache(model, record.get('pk'))) {
                    records.splice(i, 1);
                    i --;
                }
            }
        }

        this.addToCache(model, records);
        return this.getCollection(model).pushObjects(records);
    },

    remove : function (model, records) {

        if (model instanceof DF.Model || model instanceof DF.Collection) {
            records = model;
            model = model.factory || model.constructor;
        }

        records = Ember.isArray(records) ? records : [records];
        this.removeFromCache(model, records);
        this.getCollection(model).removeObjects(records);
    },

    injectType : function (type, data) {

        var i,
            item,
            record,
            factory;

        factory = this.modelFor(type);
        data = Ember.isArray(data) ? data : [data];

        for (i = 0; i < data.length; i ++) {
            item = data[i];
            if (item) {
                record = this.findInCacheOrCreate(factory, item[factory.primaryKey], item);
            }
        }
    },

    inject : function (type, data) {

        var p;

        if (typeof type === 'object') {
            data = type;
            type = null;
        }

        if (type) {
            return this.injectType(type, data);
        }

        for (p in data) {
            if (this.__registry[p]) {
                this.injectType(p, data[p]);
            }
        }

        Ember.run.next(this, this.fetchUnloadedRecords);
    }

});

DF.attr = function (type, options) {

    if (typeof type === 'object') {
        options = type;
        type = 'string';
    }

    type = type || 'string';

    options = options || {};

    var attr = Ember.computed(function (key, val) {

        var data,
            oldVal,
            isDirty,
            undefined,
            dirtyAttrs,
            dirtyIndex;

        data = this.get('__data');

        if (arguments.length === 2) {

            if (!data) {
                data = {};
                this.set('__data', data);
            }

            oldVal = data[key];

            if (oldVal !== val) {

                if (!this.__originalData) {
                    this.__originalData = Ember.copy(data || {});
                    isDirty = true;
                }

                else {
                    isDirty = this.__originalData[key] !== val;
                }

                dirtyAttrs = this.get('dirtyAttributes');
                dirtyIndex = dirtyAttrs.indexOf(key);

                if (dirtyIndex < 0 && isDirty) {
                    dirtyAttrs.push(key);
                    this.set('dirtyAttributes', dirtyAttrs);
                    this.notifyPropertyChange('dirtyAttributes');
                }

                else if (!isDirty && dirtyIndex >= 0) {
                    dirtyAttrs.splice(dirtyIndex, 1);
                    this.set('dirtyAttributes', dirtyAttrs);
                    this.notifyPropertyChange('dirtyAttributes');
                }

                if (typeof this.__originalData[key] === 'undefined') {
                    this.__originalData[key] = data[key];
                }

                data[key] = val;
            }
        }

        else {
            val = data ? data[key] : undefined;
        }

        return val;

    }).property('__data');

    attr.meta({

        type : type,
        options : options,
        isAttribute : true,

        serialize : function () {

            var meta = attr.meta(),
                data = this.get('__data');

            return data ? data[meta.key] : undefined;
        },

        deserialize : function (val) {

            if (val === null && typeof options.defaultValue !== 'undefined') {
                val = options.defaultValue;
            }

            return val;
        }
    });

    return attr;
};

DF.belongsTo = function (factoryName, options) {

    var factory,
        belongsTo;

    options = options || {};

    belongsTo = Ember.computed(function (key, val) {

        var data,
            oldVal,
            isDirty,
            undefined,
            dirtyAttrs,
            dirtyIndex;

        factory = this.store.modelFor(factoryName);

        data = this.get('__data');

        if (arguments.length === 2) {

            if (!data) {
                data = {};
                this.set('__data', data);
            }

            oldVal = data[key];

            if (oldVal !== val) {

                if (!this.__originalData) {
                    this.__originalData = Ember.copy(data || {});
                    isDirty = true;
                }

                else {
                    isDirty = this.__originalData[key] !== val;
                }

                dirtyAttrs = this.get('dirtyAttributes');
                dirtyIndex = dirtyAttrs.indexOf(key);

                if (dirtyIndex < 0 && isDirty) {
                    dirtyAttrs.push(key);
                    this.set('dirtyAttributes', dirtyAttrs);
                    this.notifyPropertyChange('dirtyAttributes');
                }

                else if (!isDirty && dirtyIndex >= 0) {
                    dirtyAttrs.splice(dirtyIndex, 1);
                    this.set('dirtyAttributes', dirtyAttrs);
                    this.notifyPropertyChange('dirtyAttributes');
                }

                if (typeof val === 'string' || typeof val === 'number') {
                    val = this.store.findInCacheOrCreate(factoryName, val);
                }

                if (val) {
                    Ember.assert(
                        Ember.String.fmt('Attempted to set property of type: %@ with a value of type: %@',
                        [val.constructor, factoryName]),
                        val instanceof factory
                    );
                }

                if (typeof this.__originalData[key] === 'undefined') {
                    this.__originalData[key] = data[key];
                }

                data[key] = val;
            }
        }

        else {
            val = data ? data[key] : undefined;
        }

        return val;

    }).property('__data');

    belongsTo.meta({

        type : 'belongsTo',
        isRelationship : true,
        options : options,
        factory : factory,

        serialize : function () {

            var val,
                data,
                meta,
                undefined;

            data = this.get('__data');
            meta = belongsTo.meta();
            val = data ? data[meta.key] : undefined;

            if (val && val instanceof DF.Model) {

                if (options.embedded) {
                    return val.serialize();
                }

                return val.get('pk');
            }

            return val;
        },

        deserialize : function (val, skipDirty) {

            var meta,
                data,
                record;

            meta = belongsTo.meta();
            data = this.get('__data');

            if (options.embedded) {

                record = data && data[meta.key] || factory.create();

                if (val && typeof val === 'object') {
                    record.deserialize(val, skipDirty);
                }
            }

            else {
                record = this.store.findInCacheOrCreate(factoryName, val);
            }

            return record;
        }
    });

    return belongsTo;
};

DF.hasMany = function (factoryName, options) {

    var factory,
        hasMany;

    options = options || {};

    hasMany = Ember.computed(function (key, val) {

        var data,
            undef,
            oldVal,
            oldLen,
            isDirty,
            undefined,
            dirtyAttrs,
            dirtyIndex;

        factory = this.store.modelFor(factoryName);

        data = this.get('__data');

        if (arguments.length === 2) {

            if (!data) {
                data = {};
                this.set('__data', data);
            }

            oldVal = data[key];

            if (oldVal !== val) {

                if (!this.__originalData) {
                    this.__originalData = Ember.copy(data || {});
                    isDirty = true;
                }

                else {
                    isDirty = this.__originalData[key] !== val;
                }

                dirtyAttrs = this.get('dirtyAttributes');
                dirtyIndex = dirtyAttrs.indexOf(key);

                if (dirtyIndex < 0 && isDirty) {
                    dirtyAttrs.push(key);
                    this.set('dirtyAttributes', dirtyAttrs);
                    this.notifyPropertyChange('dirtyAttributes');
                }

                else if (!isDirty && dirtyIndex >= 0) {
                    dirtyAttrs.splice(dirtyIndex, 1);
                    this.set('dirtyAttributes', dirtyAttrs);
                    this.notifyPropertyChange('dirtyAttributes');
                }

                if (val) {

                    Ember.assert(
                        Ember.String.fmt('Attempted to set property of type: %@ with a value of type: %@',
                        [val.constructor, DF.Collection]),
                        val instanceof DF.Collection
                    );
                }

                if (typeof this.__originalData[key] === 'undefined') {
                    this.__originalData[key] = data[key];
                }

                data[key] = val;

                if (val) {

                    var oldLen = data[key] && data[key].get('content.length') || 0;

                    Ember.addObserver(val, 'length', this, function () {

                        dirtyAttrs = this.get('dirtyAttributes');
                        dirtyIndex = dirtyAttrs.indexOf(key + '.length');

                        if (val.get('length') !== oldLen) {

                            if (dirtyIndex < 0) {
                                dirtyAttrs.push(key + '.length');
                                this.set('dirtyAttributes', dirtyAttrs);
                                this.notifyPropertyChange('dirtyAttributes');
                            }
                        }

                        else {
                            dirtyAttrs.splice(dirtyIndex, 1);
                            this.set('dirtyAttributes', dirtyAttrs);
                            this.notifyPropertyChange('dirtyAttributes');
                        }
                    });
                }
            }
        }

        else {
            val = data ? data[key] : undefined;
        }

        return val;

    }).property('__data');

    hasMany.meta({

        type : 'hasMany',
        isRelationship : true,
        options : options,
        factory : factory,

        serialize : function () {

            var i,
                val,
                map,
                meta,
                val2,
                data,
                undefined;

            map = options.map || {};

            data = this.get('__data');
            meta = hasMany.meta();
            val = data ? data[meta.key] :  undefined;

            val = val ? val.serialize(options.embedded) : val;

            if (val && options.fromObject) {

                val2 = {};

                for (i = 0; i < val.length; i ++) {

                    if (map.value) {
                        val2[val[i][map.key]] = val[i][map.value];
                    }

                    else {
                        val2[val[i][map.key]] = val[i];
                        delete val[i][map.key];
                    }
                }

                val = val2;
            }

            return val;
        },

        revert : function () {

            var data,
                meta,
                json;

            meta = hasMany.meta();
            data = this.get('__data');

            json = this.get('__' + meta.key + '_json');

            if (json) {
                meta.deserialize.call(this, json);
            }

        },

        deserialize : function (val, skipDirty) {

            var i,
                j,
                obj,
                obj2,
                map,
                val2,
                meta,
                data,
                record,
                record2,
                records,
                collection;

            meta = hasMany.meta();
            data = this.get('__data');

            map = options.map || {};

            if (skipDirty && options.embedded) {
                val2 = data && data[meta.key];

                if (val2) {
                    if (val2.get('isDirty')) {
                        return val2;
                    }
                }
            }

            if (!val) {
                val = [];
            }

            if (val && !Ember.isArray(val) && typeof val === 'object') {

                options.fromObject = true;
                val2 = [];

                for (i in val) {

                    if (val[i] && !Ember.isArray(val[i]) && typeof val[i] === 'object') {
                        obj = val[i];
                    }

                    else {
                        obj = {value : val[i]};
                    }

                    obj.key = i;
                    obj2 = {};

                    for (j in obj) {
                        obj2[map[j] || j] = obj[j];
                    }

                    val2.push(obj2);
                }

                val = val2;
            }

            val = Ember.isArray(val) ? val : [val];
            records = [];

            collection = data && data[meta.key] || DF.Collection.create({content : Ember.A()});

            if (options.embedded) {
                this.set('__' + meta.key + '_json', val);
            }

            if (options.itemController) {
                collection.set('itemController', options.itemController);
            }

            for (i = 0; i < val.length; i ++) {

                if (val && val[i]) {

                    if (options.embedded && typeof val[i] === 'object') {

                        record = collection.get('content')[i];

                        if (!record) {
                            record = factory.create();
                            records.push(record);
                        }

                        record.deserialize(val[i]);
                    }

                    else {
                        record = this.store.findInCacheOrCreate(factoryName, val[i]);
                        record2 = collection.get('content')[i];

                        if (!record2) {
                            records.push(record);
                        }

                        else if (record !== record2) {
                            collection.replaceContent(i, 1, [record]);
                        }

                    }
                }
            }

            if (val.length < collection.get('length')) {
                collection.removeAt(val.length, collection.get('length') - val.length);
            }

            collection.set('factory', factory);
            collection.set('primaryKey', factory.primaryKey);
            collection.set('typeKey', factory.typeKey);
            collection.set('collectionKey', factory.collectionKey);

            if (records.length) {
                collection.pushObjects(records);
            }

            return collection;
        }
    });

    return hasMany;
};

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