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

    removeByPrimaryKey : function () {
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