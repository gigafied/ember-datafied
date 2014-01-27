DF.belongsTo = function (factoryName, options) {

    var factory,
        belongsTo;

    options = options || {};

    belongsTo = Ember.computed(function (key, val) {

        var data,
            oldVal;

        factory = this.store.modelFor(factoryName);

        data = this.get('__data');

        if (arguments.length === 2) {

            if (!data) {
                data = {};
                this.set('__data', data);
            }

            oldVal = data[key];

            if (oldVal !== val) {

                if (!this.__original) {
                    this.__original = this.clone();
                }

                this.__changedAttributes = this.__changedAttributes || [];
                this.__changedAttributes.push(key);

                this.set('__isDirty', true);

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

                data[key] = val;
            }
        }

        else {
            val = data ? data[key] : null;
        }

        return val;

    }).property('__data');

    belongsTo.meta({

        type : 'belongsTo',
        isRelationship : true,
        options : options,

        serialize : function () {

            var val,
                data,
                meta;

            data = this.get('__data');
            meta = belongsTo.meta();
            val = data ? data[meta.key] : null;

            if (val && val instanceof DF.Model) {

                if (options.embedded) {
                    return val.serialize();
                }

                return val.get('pk');
            }

            return val;
        },

        deserialize : function (val) {

            var meta,
                record;

            meta = belongsTo.meta();

            if (options.embedded && typeof val === 'object') {
                record = factory.create();
                record.deserialize(val);
            }

            else {
                record = this.store.findInCacheOrCreate(factoryName, val);
            }

            return record;
        }
    });

    return belongsTo;
};