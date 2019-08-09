const moment = require("moment")
var httpService = require("./http-service")
const errorHandlerObjects = require("./error-messages")

const itemResources = ["items"]

module.exports = {

	name: "task_completed",

	label: "Task Completed",

	version: "v3",

	input: {
		type: "object",
		title: "Task Completed",
		description: "Short description",
		properties: {
			event: {
				type: "string",
				enum: ["task_completed"],
				scopes: ["data:read"],
				required_scopes: ["data:read"],
				isExecute: true
			},
			polling: {
				type: "boolean",
				default: true,
				options: {
					hidden: true
				}
			},
			project_id: {
				type: "string",
				title: "Project",
				description: "Select/specify the ID of the project on which you want to set the trigger",
				minLength: 1,
				propertyOrder: 1,
			},
			label_id: {
				type: "string",
				title: "Label",
				description: "Select/specify the ID of the label associated with the task on which you want to set the trigger. Labels help you batch similar tasks giving sense to your workflow. Set this trigger on a specific or all labels and track the progress of the tasks accordingly."
			}
		}
	},

	output: {
		"task_completed": {
			type: "object",
			properties: {

			}
		}
	},

	mock_data: {
		"event_type": "Task Completed",
		"type": "Completed Subtask",
		"id": 2806982376,
		"content": "Content of the TasK",
		"project": {
			"id": 2193893852,
			"name": "Project Name",
			"url": "https://todoist.com/app#project/2193893852"
		},
		"user": {
			"user_id": 18306887,
			"name": "User's full name",
			"email": "user@email.com",
			"mobile_number": "+15417543010"
		},
		"priority": 1,
		"date_added": "Mon 10 Sep 2018 06:12:57 +0000",
		"date_completed": "",
		"url": "https://todoist.com/app#task/2806982376",
		"parent_id": 12782378,
		"parent_name": "Parent Name",
		"is_archived": 0,
		"is_deleted": 0,
		"labels": [{
			"id": 2387289,
			"name": "label",
			"url": "https://todoist.com/app#agenda/@label"
		}],
		"all_day": false,
		"in_history": 0,
		"indent": 1,
		"checked": 0,
		"due_date_utc": "",
		"item_order": 13,
		"collapsed": 0,
		"date_string": ""
	},

	mock_input: {},

	makeValidateRequest: function (accessToken, synToken, projectId, labelId) {
		const promiseArr = [
			httpService.getSyncData(accessToken, itemResources, synToken),
			httpService.getSyncData(accessToken, ["user"], "*"),
			httpService.getRequest(accessToken, "projects", projectId, errorHandlerObjects.get_project_errors)
		]

		if (labelId) {
			promiseArr.push(httpService.getRequest(accessToken, "labels", labelId, errorHandlerObjects.get_label_errors))
		}

		return Promise.all(promiseArr).then(body => {
			return new Promise((resolve, reject) => {
				if (
					body && body.length == promiseArr.length && body[0].sync_token &&
					body[0].items && body[1].user && body[2] && body[2].id == projectId
				) {
					let ret = {}
					ret["items"] = body[0].items
					ret["sync_token"] = body[0].sync_token
					ret["user"] = body[1].user
					ret["project"] = body[2]
					resolve(ret)

				} else if (!body || body.length != promiseArr.length) {
					reject("Invalid response from the client")
				} else if (!body[0].sync_token) {
					reject("No Authorization details from the client")
				} else if (!body[0].items) {
					reject("No todo details in the response sent from client")
				} else if (!body[1].user) {
					reject("No users details in the response sent from the client")
				} else if (!body[2] || body[2].id != projectId) {
					reject("No matching project found please select the existing project")
				} else if (!body[1].items) {
					reject("Error while fetching all task")
				} else if (!body[1].labels) {
					reject("Error label not found")
				} else {
					reject("Unknown error reported please contact customer support team")
				}
			})
		})
	},

	execute: function (input, options, output) {
		this.makeValidateRequest(input.auth.access_token, options.meta.syncToken, input.project_id)
			.then(body => {
				let filteredTasks = this.filterTasks(
					body.items, options.meta.lastFetchDate, body.project, input.label_id
				) || []

				this.setOptions(options, body)

				return this.outputSchema(
					filteredTasks,
					body.project,
					body.user,
					input.auth.access_token
				)
			}).then(body => {
				output(null, body)
				return 1
			}).catch((error) => {
				output(error)
			})
	},

	activate: function (input, options, output) {
		this.makeValidateRequest(input.auth.access_token, options.meta.syncToken, input.project_id)
			.then((body) => {
				this.setOptions(options, body)

				output(null, "Activated")
			}).catch((error) => {
				output(error)
			})

	},

	validate: function (input, options, output) {
		this.makeValidateRequest(
			input.auth.access_token,
			options.meta.syncToken,
			input.project_id,
			input.label_id && input.label_id !== "all" ? input.label_id : ""
		).then((body) => {

			// TODO: Remove redundant error handling as most of the vallidation are done at the request handling
			if (
				body && body.sync_token && body.items && body.project &&
				body.user && body.project.id == input.project_id
			) {
				this.setOptions(options, body)
				output(null, "Validated")
			} else if (!body.sync_token) {
				output("Authorization error")
			} else if (!body.project || body.project.id != input.project_id) {
				output("project Not Found")
			} else if (body.user) {
				output("User Not found")
			} else if (body.items) {
				output("No todo's found")
			} else {
				output("Unknow error please contact support team")
			}
		}).catch((error) => {
			output(error)
		})
	},

	setOptions: function (options, body) {
		var maxDate = options.meta.lastFetchDate && moment(options.meta.lastFetchDate)

		// Handling if the maxDate is undefiend
		body.items.length > 0 && !maxDate &&
			(maxDate = moment(body.items[0].date_added, "ddd DD MMM YYYY HH:mm:ss +Z"))

		body.items.length > 0 && body.items.forEach(item => {
			if (item.date_completed && maxDate < moment(item.date_completed, "ddd DD MMM YYYY HH:mm:ss +Z")) {
				maxDate = moment(item.date_completed, "ddd DD MMM YYYY HH:mm:ss +Z")
			}
		})

		options.setMeta({
			lastFetchDate: maxDate && maxDate.toISOString(),
			syncToken: body.sync_token,
		})
	},

	filterTasks: function (tasks, lastFetchedDate, project, label) {
		const timeStamp = moment(lastFetchedDate)

		return tasks && tasks.length > 0 ? tasks.filter(task => {
			if (task.project_id == project.id &&
				task.date_completed &&
				moment(task.date_completed, "ddd DD MMM YYYY HH:mm:ss +Z") > timeStamp
			) {
				if (label == "") {
					return true
				} else if (label == "all" && task.labels && task.labels.length > 0) {
					return true
				} else if (
					task.labels && task.labels.length > 0 &&
					task.labels.findIndex(label_id => label_id.toString() == label) != -1
				) {
					return true
				} else {
					return false
				}
			} else {
				return false
			}
		}) : []

	},

	outputSchema: function (tasks, project, user, accessToken) {

		const isKeyPresent = (ret, item, key) => {
			ret[key] = item[key] || (item[key] === false ? false : (item[key] === 0 ? 0 : ""))
		}

		return tasks && tasks.length > 0 ? Promise.all(tasks.map(item => {
			return new Promise(resolve => {
				let ret = {}
				resolve(ret)
			}).then(ret => {
				ret["event_type"] = "Task Completed"
				ret["type"] = item["parent_id"] ? "Completed Subtask" : "Completed Task"

				isKeyPresent(ret, item, "id")
				isKeyPresent(ret, item, "content")

				if (item["project_id"]) {
					ret["project"] = {}
					isKeyPresent(ret["project"], item, "project_id")
					isKeyPresent(ret["project"], project, "name")
					ret["project"]["url"] = "https://todoist.com/app#project/" + item["project_id"]
				}

				if (item["user_id"]) {
					ret["user"] = {}
					isKeyPresent(ret["user"], item, "user_id")
					isKeyPresent(ret["user"], user, "name")
					isKeyPresent(ret["user"], user, "email")
					isKeyPresent(ret["user"], user, "mobile_number")
				}

				isKeyPresent(ret, item, "priority")
				isKeyPresent(ret, item, "date_added")
				isKeyPresent(ret, item, "date_completed")
				if (ret["date_added"]) {
					ret["date_added"] =
						moment(item.date_added, "ddd DD MMM YYYY HH:mm:ss +Z").toISOString()
				}

				if (ret["id"]) {
					ret["url"] = "https://todoist.com/app#task/" + ret["id"]
				}

				isKeyPresent(ret, item, "parent_id")
				isKeyPresent(ret, item, "parent_name")

				if (item["parent_id"]) {
					return httpService.getRequest(accessToken, "tasks", item["parent_id"])
						.then((body) => {
							ret["parent_name"] = body.content
							return ret
						}).catch(() => {
							return ret
						})

				} else {
					return ret
				}
			}).then(ret => {
				isKeyPresent(ret, item, "is_archived")
				isKeyPresent(ret, item, "is_deleted")
				isKeyPresent(ret, item, "labels")

				if (item["labels"].length > 0) {
					let promiseRequests = []
					item["labels"].forEach(label => {
						promiseRequests.push(
							httpService.getRequest(accessToken, "labels", label)
						)
					})

					return Promise.all(promiseRequests).then(body => {
						ret["labels"] = []
						item["labels"].forEach((label, index) => {
							label = {
								id: label,
								name: body[index] && body[index].name || ""
							}

							label.url = label.name ? "https://todoist.com/app#agenda/@" + label.name : ""

							ret.labels.push(label)
						})

						return ret
					}).catch(() => {
						ret["labels"] = item.labels.map(label => {
							return {
								id: label,
								name: "",
								url: ""
							}
						})

						return ret

					})
				} else {
					return ret
				}
			}).then(ret => {
				isKeyPresent(ret, item, "all_day")
				isKeyPresent(ret, item, "in_history")
				isKeyPresent(ret, item, "indent")
				isKeyPresent(ret, item, "checked")
				isKeyPresent(ret, item, "due_date_utc")
				isKeyPresent(ret, item, "item_order")
				isKeyPresent(ret, item, "collapsed")
				isKeyPresent(ret, item, "date_string")

				return ret
			}).catch(() => {
				return {
					"promiseError": "error occured for item with id " + item.id
				}
			})
		})) : []
	}
}