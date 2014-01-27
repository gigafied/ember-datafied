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