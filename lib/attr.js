DF.attr = function (type, options) {

    if (typeof type === 'object') {
        type = 'string';
        options = type;
    }

    type = type || 'string';

    options = options || {};

    var attr = Ember.computed(function (key, val) {

        var data,
            oldVal;

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

                data[key] = val;
            }
        }

        else {
            val = data ? data[key] : null;
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

            return data ? data[meta.key] : null;
        },

        deserialize : function (val) {
            return val;
        }
    });

    return attr;
};