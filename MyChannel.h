#ifndef _CHANNEL_TOOLS_HPP_
#define _CHANNEL_TOOLS_HPP_

#include <mutex>
#include <condition_variable>

#include <queue>
#include <utility>
#include <atomic>

    template<class T>
class SafeQueue {

	std::queue<T> q;

	std::mutex mtx;
	std::condition_variable cv;

	std::condition_variable sync_wait;
	bool finish_processing = false;
	int sync_counter = 0;
	std::atomic<uint32_t> timeout=4294967294;

	void DecreaseSyncCounter() {
		if (--sync_counter == 0) {
			sync_wait.notify_one();
		}
	}

public:

	typedef typename std::queue<T>::size_type size_type;

	SafeQueue() {
		
	}

	~SafeQueue() {
		Finish();
	}

	void SetTimeout(uint32_t timeout_)
	{
		timeout.store(timeout_);
	}
	void Produce(T&& item) {

		std::lock_guard<std::mutex> lock(mtx);

		q.push(std::move(item));
		cv.notify_one();

	}

	size_type Size() {

		std::lock_guard<std::mutex> lock(mtx);

		return q.size();

	}

	[[nodiscard]]
	bool Consume(T& item) {

		std::lock_guard<std::mutex> lock(mtx);

		if (q.empty()) {
			return false;
		}

		item = std::move(q.front());
		q.pop();

		return true;

	}

	[[nodiscard]]
	bool ConsumeSync(T& item) {

		std::unique_lock<std::mutex> lock(mtx);

		sync_counter++;
		
		bool result = cv.wait_for(lock, std::chrono::seconds(timeout.load()), [&] {
			return !q.empty() || finish_processing;
		});
	/*	if (result == std::cv_status::timeout) {
			DecreaseSyncCounter();
			return false;
		} */
		
		/*cv.wait(lock, [&] {
			return !q.empty() || finish_processing;
		});*/
		

		if (!result) {
			DecreaseSyncCounter();
			return false;
		}

		item = std::move(q.front());
		q.pop();

		DecreaseSyncCounter();
		return true;

	}

	void Finish() {

		std::unique_lock<std::mutex> lock(mtx);

		finish_processing = true;
		cv.notify_all();

		sync_wait.wait(lock, [&]() {
			return sync_counter == 0;
		});

		finish_processing = false;

	}

};


#define THREAD_POOL(CLASS_NAME,...)\
        template<class T>\
        class CLASS_NAME {\
        private:\
            sf::safe_ptr<std::vector<std::thread>> workers;\
			std::atomic<int> busy_{0};\
			void Process(T temp)\
			{\
				 __VA_ARGS__\
			}\
        public:\
            SafeQueue<T> queue;\
            CLASS_NAME(size_t threadCount = std::thread::hardware_concurrency()) \
            {\
                for (size_t i = 0; i < threadCount; ++i) {\
                    workers->emplace_back([this] {\
                        T temp;\
                        while (queue.ConsumeSync(temp)) {\
							busy_++;\
							if(busy_>=workers->size()) AddNew();\
                            Process(temp);\
							busy_--;\
                        }\
                    });\
                }\
            }\
            ~CLASS_NAME() {\
				for (auto worker = workers->begin(); worker != workers->end(); ++worker) {\
                    if (worker->joinable()) {\
                        worker->join();\
                    }\
                }\
            }\
			void AddNew()\
			{\
				workers->emplace_back([this] {\
					T temp;\
					while (queue.ConsumeSync(temp)) {\
						Process(temp);\
					}\
				});\
			}\
        };


#endif // _CHANNEL_TOOLS_HPP_