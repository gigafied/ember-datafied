DF.hasMany = function (factoryName, options) {

    var factory,
        hasMany;

    options = options || {};

    hasMany = Ember.computed(function (key, val) {

        var data,
            oldVal,
            isDirty,
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
                    this.__originalData[key] = val;
                }

                data[key] = val;
            }
        }

        else {
            val = data ? data[key] : null;
        }

        return val;

    }).property('__data');

    hasMany.meta({

        type : 'hasMany',
        isRelationship : true,
        options : options,
        factory : factory,

        serialize : function () {

            var val,
                meta,
                data;

            data = this.get('__data');
            meta = hasMany.meta();
            val = data ? data[meta.key] : null;

            return val ? val.serialize(options.embedded) : null;
        },

        deserialize : function (val) {

            var i,
                meta,
                record,
                records,
                collection;

            meta = hasMany.meta();
            val = Ember.isArray(val) ? val : [val];
            records = [];

            collection = DF.Collection.create({content : Ember.A()});

            for (i = 0; i < val.length; i ++) {

                if (val && val[i]) {

                    if (options.embedded && typeof val[i] === 'object') {
                        record = factory.create();
                        record.deserialize(val[i]);
                    }

                    else {
                        record = this.store.findInCacheOrCreate(factoryName, val);
                    }

                    records.push(record);
                }
            }

            if (records.length) {
                collection.set('factory', factory);
                collection.set('primaryKey', factory.primaryKey);
                collection.set('typeKey', factory.typeKey);
                collection.set('collectionKey', factory.collectionKey);

                collection.pushObjects(records);
            }

            return collection;
        }
    });

    return hasMany;
};