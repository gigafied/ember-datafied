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
    __isDirty : false,
    __isLoaded : false,
    __isDeleting : false,
    __isDeleted : false,

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

    isValid : function () {
        return this.validate();
    }.property(),

    isNew : function () {
        return !this.get('pk');
    }.property(),

    isLoaded : function () {
        return this.get('__isLoaded');
    }.property('__isLoaded'),

    isLoading : function () {
        return !this.get('__isLoaded');
    }.property('__isLoaded'),

    isDeleted : function () {
        return this.get('__isDeleted');
    }.property('__isDeleted'),

    isDirty : function () {
        return this.get('__isDirty');
    }.property('__isDirty'),

    isClean : function () {
        return !this.isDirty();
    }.property('__isDirty'),

    serialize : function (isNested) {

        var p,
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

            json[key] = meta.serialize.call(this);
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

    deserialize : function (json) {

        var p,
            pk,
            key,
            meta,
            item,
            data,
            jsonItem,
            attributes,
            properties,
            relationships;

        data = {};
        attributes = this.getAttributes();
        relationships = this.getRelationships();

        properties = this.getProperties(attributes.concat(relationships));

        pk = this.get('pk');

        for (p in properties) {

            meta = this.constructor.metaForProperty(p);
            key = meta.options.key || p;

            jsonItem = json[key];

            if (typeof jsonItem !== 'undefined') {
                data[meta.key] = jsonItem === null ? null : meta.deserialize.call(this, jsonItem);
            }
        }

        if (this.primaryKey) {
            this.set('pk', json[this.primaryKey] || null);
        }

        this.set('__data', data);
        this.set('__isLoaded', true);
        this.set('__isDirty', false);
    },

    validate : function () {
        return true;
    },

    merge : function (data) {
        this.deserialize(data instanceof DF.Model ? data.deserialize() : data);
    },

    save : function () {
        return this.saveRecord();
    },

    fetch : function () {
        return this.fetchRecord();
    },

    fetchRecord : function () {

        this.set('__isLoaded', false);

        if (this.__currentPromise) {
            if (this.__currentPromise._state !== 1 && this.__currentPromise._state !== 2) {
                return this.__currentPromise = this.__currentPromise.then(this.fetchRecord.bind(this));
            }
        }

        return this.__currentPromise = this.adapter.fetch(this.constructor, this.get('pk')).then(function (json) {

            json = json[this.typeKey] || json;
            json = Ember.isArray(json) ? json[0] : json;

            this.deserialize(json);

        }.bind(this));
    },

    saveRecord : function () {

        if (this.get('isValid')) {

            if (this.__currentPromise) {
                if (this.__currentPromise._state !== 1 && this.__currentPromise._state !== 2) {
                    return this.__currentPromise = this.__currentPromise.then(this.saveRecord.bind(this));
                }
            }

            this.set('__isDirty', false);

            return this.__currentPromise = this.adapter.saveRecord(this).then(function (json) {

                var isNew = this.get('isNew');

                json = json[this.typeKey] || json;
                json = Ember.isArray(json) ? json[0] : json;

                this.deserialize(json);

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

        if (this.__currentPromise) {
            if (this.__currentPromise._state !== 1 && this.__currentPromise._state !== 2) {
                return this.__currentPromise = this.__currentPromise.then(this.deleteRecord.bind(this));
            }
        }

        return this.__currentPromise = this.adapter.deleteRecord(this).then(function (json) {

            this.store.remove(this);

            this.set('__isDeleting', false);
            this.set('__isDeleted', true);

            this.destroy();

        }.bind(this));
    },

    clone : function () {

        var copy,
            data;

        data = this.get('__data') || {};

        copy = this.constructor.create();
        copy.set('__data', data);
        copy.set('pk', null);

        copy.set('__isLoaded', true);
        copy.set('__isDirty', false);

        return copy;
    },

    revert : function () {
        this.merge(this.__original);
        this.__original.destroy();
        this.__original = null;
        this.__dirtyAttributes = null;
        this.set('__isDirty', false);
    }
});

DF.Model.reopenClass({

    getAttributes : function (a) {

        this.proto();
        a = this.__attributes || [];

        if (typeof this.superclass.getAttributes === 'function') {
            a = this.superclass.getAttributes().concat(a);
        }

        return a;
    },

    getRelationships : function (a) {

        this.proto();
        a = this.__relationships || [];

        if (typeof this.superclass.getRelationships === 'function') {
            a = this.superclass.getRelationships().concat(a);
        }

        return a;
    },

    extend : function () {

        var i,
            r,
            d,
            p,
            props,
            classProps;

        d = {};
        r = this._super.apply(this, arguments);
        classProps = ['primaryKey', 'url', 'adapter', 'typeKey', 'collectionKey'];

        props = [].slice.apply(arguments, [-1])[0];

        for (i = 0; i < classProps.length; i ++) {

            p = props[classProps[i]];

            if (p) {
                d[classProps[i]] = p;
            }
        }

        r.reopenClass(d);

        return r;
    }
});